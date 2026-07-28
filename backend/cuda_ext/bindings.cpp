#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <cstring>
#include <stdexcept>
#include <vector>

namespace py = pybind11;

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

struct KMeansContext;

int kmeans_get_device_props(DeviceProps* out);
int kmeans_get_vram_used(unsigned long long* used, unsigned long long* total);
KMeansContext* kmeans_create(const float* h_x, const float* h_y, int n,
                              const float* h_centroids, int k, int block_size);
void kmeans_destroy(KMeansContext* ctx);
int kmeans_step(KMeansContext* ctx, float* out_centroids, int* out_assignments, StepResult* result);
void kmeans_set_centroids(KMeansContext* ctx, const float* h_centroids);

}  // extern "C"

class GPUKMeans {
public:
    GPUKMeans(py::array_t<float, py::array::c_style | py::array::forcecast> x,
              py::array_t<float, py::array::c_style | py::array::forcecast> y,
              py::array_t<float, py::array::c_style | py::array::forcecast> centroids,
              int block_size) {
        auto xb = x.request();
        auto yb = y.request();
        auto cb = centroids.request();
        if (xb.ndim != 1 || yb.ndim != 1) throw std::runtime_error("x, y must be 1D arrays");
        if (cb.ndim != 2 || cb.shape[1] != 2) throw std::runtime_error("centroids must be (K, 2)");

        n_ = static_cast<int>(xb.shape[0]);
        k_ = static_cast<int>(cb.shape[0]);

        ctx_ = kmeans_create(static_cast<float*>(xb.ptr), static_cast<float*>(yb.ptr), n_,
                              static_cast<float*>(cb.ptr), k_, block_size);
        if (!ctx_) throw std::runtime_error("failed to initialize CUDA K-Means context");
    }

    ~GPUKMeans() {
        if (ctx_) kmeans_destroy(ctx_);
    }

    py::dict step() {
        std::vector<float> centroids(static_cast<size_t>(k_) * 2);
        std::vector<int> assignments(static_cast<size_t>(n_));
        StepResult result{};
        int rc;

        {
            py::gil_scoped_release release;
            rc = kmeans_step(ctx_, centroids.data(), assignments.data(), &result);
        }
        if (rc != 0) throw std::runtime_error("kmeans_step failed");

        py::array_t<float> py_centroids(std::vector<py::ssize_t>{k_, 2});
        std::memcpy(py_centroids.mutable_data(), centroids.data(), centroids.size() * sizeof(float));

        py::array_t<int> py_assign(static_cast<py::ssize_t>(n_));
        std::memcpy(py_assign.mutable_data(), assignments.data(), assignments.size() * sizeof(int));

        py::dict out;
        out["centroids"] = py_centroids;
        out["assignments"] = py_assign;
        out["assign_ms"] = result.assign_ms;
        out["update_ms"] = result.update_ms;
        out["grid_size"] = result.grid_size;
        out["block_size"] = result.block_size;
        out["threads_launched"] = result.threads_launched;
        return out;
    }

    void set_centroids(py::array_t<float, py::array::c_style | py::array::forcecast> centroids) {
        auto cb = centroids.request();
        if (cb.ndim != 2 || cb.shape[0] != k_ || cb.shape[1] != 2) {
            throw std::runtime_error("centroids must be (K, 2)");
        }
        kmeans_set_centroids(ctx_, static_cast<float*>(cb.ptr));
    }

private:
    KMeansContext* ctx_ = nullptr;
    int n_ = 0;
    int k_ = 0;
};

static py::dict device_info() {
    DeviceProps props{};
    if (kmeans_get_device_props(&props) != 0) throw std::runtime_error("no CUDA device available");
    py::dict d;
    d["name"] = std::string(props.name);
    d["sm_count"] = props.sm_count;
    d["cuda_cores"] = props.cuda_cores;
    d["compute_capability"] = std::to_string(props.compute_major) + "." + std::to_string(props.compute_minor);
    d["vram_total_bytes"] = props.vram_total;
    return d;
}

static py::dict vram_info() {
    unsigned long long used = 0, total = 0;
    if (kmeans_get_vram_used(&used, &total) != 0) throw std::runtime_error("cudaMemGetInfo failed");
    py::dict d;
    d["vram_used_bytes"] = used;
    d["vram_total_bytes"] = total;
    return d;
}

PYBIND11_MODULE(kmeans_cuda, m) {
    m.doc() = "Real CUDA K-Means kernels exposed to Python";

    py::class_<GPUKMeans>(m, "GPUKMeans")
        .def(py::init<py::array_t<float, py::array::c_style | py::array::forcecast>,
                      py::array_t<float, py::array::c_style | py::array::forcecast>,
                      py::array_t<float, py::array::c_style | py::array::forcecast>,
                      int>(),
             py::arg("x"), py::arg("y"), py::arg("centroids"), py::arg("block_size") = 256)
        .def("step", &GPUKMeans::step)
        .def("set_centroids", &GPUKMeans::set_centroids);

    m.def("device_info", &device_info);
    m.def("vram_info", &vram_info);
}
