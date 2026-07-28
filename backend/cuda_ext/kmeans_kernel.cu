#include <cuda_runtime.h>
#include <cstring>

extern "C" {

struct DeviceProps {
    char name[256];
    int sm_count;
    int cuda_cores;
    int compute_major;
    int compute_minor;
    unsigned long long vram_total;
};

struct StepResult {
    float assign_ms;
    float update_ms;
    int grid_size;
    int block_size;
    int threads_launched;
};

struct KMeansContext {
    float* d_x;
    float* d_y;
    float* d_centroids;
    int* d_assign;
    float* d_sums_x;
    float* d_sums_y;
    int* d_counts;
    int n;
    int k;
    int block_size;
    int grid_size;
};

}  // extern "C"

static int cores_per_sm(int major, int minor) {
    struct Entry { int major, minor, cores; };
    static const Entry table[] = {
        {2, 0, 32}, {2, 1, 48},
        {3, 0, 192}, {3, 5, 192}, {3, 7, 192},
        {5, 0, 128}, {5, 2, 128}, {5, 3, 128},
        {6, 0, 64}, {6, 1, 128}, {6, 2, 128},
        {7, 0, 64}, {7, 2, 64}, {7, 5, 64},
        {8, 0, 64}, {8, 6, 128}, {8, 7, 128}, {8, 9, 128},
        {9, 0, 128},
        {10, 0, 128}, {12, 0, 128},
    };
    for (const auto& e : table) {
        if (e.major == major && e.minor == minor) return e.cores;
    }
    return 128;
}

__global__ void assign_kernel(const float* x, const float* y, const float* centroids,
                               int* assign, int n, int k) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= n) return;
    float px = x[idx];
    float py = y[idx];
    float best_dist = 3.402823466e38f;
    int best_k = 0;
    for (int c = 0; c < k; ++c) {
        float dx = px - centroids[c * 2];
        float dy = py - centroids[c * 2 + 1];
        float d = dx * dx + dy * dy;
        if (d < best_dist) {
            best_dist = d;
            best_k = c;
        }
    }
    assign[idx] = best_k;
}

__global__ void accumulate_kernel(const float* x, const float* y, const int* assign,
                                   float* sums_x, float* sums_y, int* counts, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= n) return;
    int c = assign[idx];
    atomicAdd(&sums_x[c], x[idx]);
    atomicAdd(&sums_y[c], y[idx]);
    atomicAdd(&counts[c], 1);
}

__global__ void finalize_kernel(const float* sums_x, const float* sums_y, const int* counts,
                                 float* centroids, int k) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= k) return;
    int cnt = counts[idx];
    if (cnt > 0) {
        centroids[idx * 2] = sums_x[idx] / cnt;
        centroids[idx * 2 + 1] = sums_y[idx] / cnt;
    }
}

extern "C" {

int kmeans_get_device_props(DeviceProps* out) {
    cudaDeviceProp prop;
    cudaError_t err = cudaGetDeviceProperties(&prop, 0);
    if (err != cudaSuccess) return -1;
    std::memset(out, 0, sizeof(DeviceProps));
    std::strncpy(out->name, prop.name, 255);
    out->sm_count = prop.multiProcessorCount;
    out->compute_major = prop.major;
    out->compute_minor = prop.minor;
    out->cuda_cores = prop.multiProcessorCount * cores_per_sm(prop.major, prop.minor);
    out->vram_total = static_cast<unsigned long long>(prop.totalGlobalMem);
    return 0;
}

int kmeans_get_vram_used(unsigned long long* used, unsigned long long* total) {
    size_t free_b = 0, total_b = 0;
    cudaError_t err = cudaMemGetInfo(&free_b, &total_b);
    if (err != cudaSuccess) return -1;
    *total = static_cast<unsigned long long>(total_b);
    *used = static_cast<unsigned long long>(total_b - free_b);
    return 0;
}

KMeansContext* kmeans_create(const float* h_x, const float* h_y, int n,
                              const float* h_centroids, int k, int block_size) {
    KMeansContext* ctx = new KMeansContext();
    ctx->n = n;
    ctx->k = k;
    ctx->block_size = block_size;
    ctx->grid_size = (n + block_size - 1) / block_size;

    if (cudaMalloc(&ctx->d_x, n * sizeof(float)) != cudaSuccess) { delete ctx; return nullptr; }
    if (cudaMalloc(&ctx->d_y, n * sizeof(float)) != cudaSuccess) { delete ctx; return nullptr; }
    if (cudaMalloc(&ctx->d_centroids, k * 2 * sizeof(float)) != cudaSuccess) { delete ctx; return nullptr; }
    if (cudaMalloc(&ctx->d_assign, n * sizeof(int)) != cudaSuccess) { delete ctx; return nullptr; }
    if (cudaMalloc(&ctx->d_sums_x, k * sizeof(float)) != cudaSuccess) { delete ctx; return nullptr; }
    if (cudaMalloc(&ctx->d_sums_y, k * sizeof(float)) != cudaSuccess) { delete ctx; return nullptr; }
    if (cudaMalloc(&ctx->d_counts, k * sizeof(int)) != cudaSuccess) { delete ctx; return nullptr; }

    cudaMemcpy(ctx->d_x, h_x, n * sizeof(float), cudaMemcpyHostToDevice);
    cudaMemcpy(ctx->d_y, h_y, n * sizeof(float), cudaMemcpyHostToDevice);
    cudaMemcpy(ctx->d_centroids, h_centroids, k * 2 * sizeof(float), cudaMemcpyHostToDevice);

    return ctx;
}

void kmeans_set_centroids(KMeansContext* ctx, const float* h_centroids) {
    cudaMemcpy(ctx->d_centroids, h_centroids, ctx->k * 2 * sizeof(float), cudaMemcpyHostToDevice);
}

void kmeans_destroy(KMeansContext* ctx) {
    if (!ctx) return;
    cudaFree(ctx->d_x);
    cudaFree(ctx->d_y);
    cudaFree(ctx->d_centroids);
    cudaFree(ctx->d_assign);
    cudaFree(ctx->d_sums_x);
    cudaFree(ctx->d_sums_y);
    cudaFree(ctx->d_counts);
    delete ctx;
}

int kmeans_step(KMeansContext* ctx, float* out_centroids, int* out_assignments, StepResult* result) {
    cudaEvent_t e0, e1, e2;
    cudaEventCreate(&e0);
    cudaEventCreate(&e1);
    cudaEventCreate(&e2);

    cudaEventRecord(e0);
    assign_kernel<<<ctx->grid_size, ctx->block_size>>>(
        ctx->d_x, ctx->d_y, ctx->d_centroids, ctx->d_assign, ctx->n, ctx->k);
    cudaEventRecord(e1);

    cudaMemsetAsync(ctx->d_sums_x, 0, ctx->k * sizeof(float));
    cudaMemsetAsync(ctx->d_sums_y, 0, ctx->k * sizeof(float));
    cudaMemsetAsync(ctx->d_counts, 0, ctx->k * sizeof(int));
    accumulate_kernel<<<ctx->grid_size, ctx->block_size>>>(
        ctx->d_x, ctx->d_y, ctx->d_assign, ctx->d_sums_x, ctx->d_sums_y, ctx->d_counts, ctx->n);
    int centroid_blocks = (ctx->k + 31) / 32;
    finalize_kernel<<<centroid_blocks, 32>>>(
        ctx->d_sums_x, ctx->d_sums_y, ctx->d_counts, ctx->d_centroids, ctx->k);
    cudaEventRecord(e2);

    cudaError_t err = cudaEventSynchronize(e2);
    if (err != cudaSuccess) {
        cudaEventDestroy(e0); cudaEventDestroy(e1); cudaEventDestroy(e2);
        return -1;
    }

    float assign_ms = 0.0f, update_ms = 0.0f;
    cudaEventElapsedTime(&assign_ms, e0, e1);
    cudaEventElapsedTime(&update_ms, e1, e2);

    cudaMemcpy(out_centroids, ctx->d_centroids, ctx->k * 2 * sizeof(float), cudaMemcpyDeviceToHost);
    cudaMemcpy(out_assignments, ctx->d_assign, ctx->n * sizeof(int), cudaMemcpyDeviceToHost);

    result->assign_ms = assign_ms;
    result->update_ms = update_ms;
    result->grid_size = ctx->grid_size;
    result->block_size = ctx->block_size;
    result->threads_launched = ctx->grid_size * ctx->block_size;

    cudaEventDestroy(e0);
    cudaEventDestroy(e1);
    cudaEventDestroy(e2);
    return 0;
}

}  // extern "C"
