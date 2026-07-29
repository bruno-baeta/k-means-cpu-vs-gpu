# K-Means CUDA Visualizer

Aplicativo desktop que executa o algoritmo **K-Means simultaneamente em CPU e GPU (CUDA)**,
lado a lado, para comparar desempenho e visualizar o funcionamento interno da paralelização
(grid → blocks → threads).

## Arquitetura

O projeto **não é** um site cliente-servidor clássico — é um app desktop nativo. Tudo roda no
mesmo processo Python:

```
┌─────────────────────────────── backend/desktop_main.py ───────────────────────────────┐
│                                                                                         │
│  pywebview (janela nativa, WebKitGTK)                                                  │
│    └─ carrega http://127.0.0.1:8734/index.html  (servidor HTTP estático embutido)      │
│                                                                                         │
│  window.pywebview.api  ──(js_api, chamadas síncronas JS→Python)──▶  DesktopApi         │
│                                                                        │                │
│                                                                        ▼                │
│                                                                  KMeansRuntime          │
│                                                                   ├─ CPUKMeansEngine    │
│                                                                   │   (numpy + threads) │
│                                                                   └─ GPUKMeansEngine    │
│                                                                       (pybind11 → .so →  │
│                                                                        kernels CUDA)     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Frontend** (`frontend/`): React 19 + TypeScript + Vite + Zustand, compilado como estático
  (`frontend/dist`) e servido localmente — não depende de internet nem de um servidor remoto.
- **Bridge**: comandos (`configure`, `start`, `pause`, `step`, `reset`, ...) vão direto de
  JS para Python via `js_api` do pywebview (`frontend/src/lib/desktopApi.ts` ↔
  `backend/app/desktop_api.py`). Não há WebSocket: os frames de posição (pontos, centróides,
  atribuições) são lidos por **polling em `requestAnimationFrame`** via HTTP GET binário em
  `/api/points` e `/api/frame/{cpu,gpu}` (`frontend/src/hooks/useKMeansBridge.ts`).
- **Backend "de verdade"** (`backend/app/kmeans_runtime.py`): orquestra duas engines (CPU e
  GPU) rodando em threads separadas, cada uma fazendo seu próprio loop de iterações do
  K-Means e publicando snapshots (`EngineRuntime`) que o polling do frontend lê.
- **Extensão CUDA** (`backend/cuda_ext/`): `kmeans_kernel.cu` (kernels reais) + `bindings.cpp`
  (pybind11), compilados para um módulo Python nativo (`kmeans_cuda*.so`) carregado por
  `backend/app/gpu_engine.py`. Se a extensão não estiver disponível, o app roda só com a
  coluna de CPU (degrada graciosamente, sem quebrar).

## Como rodar

### Modo rápido

```bash
./start.sh
```

O script verifica (e resolve, se possível) tudo que é necessário antes de abrir a janela:

1. Confere se existe `backend/.venv` (aborta com instruções se não existir).
2. Se a extensão CUDA (`backend/cuda_ext/kmeans_cuda*.so`) não existir, tenta compilá-la
   rodando `backend/cuda_ext/build.sh`. Se falhar (ex.: sem `nvcc`/toolkit CUDA instalado),
   avisa e segue em frente — o app abre normalmente, só sem a coluna GPU.
3. Instala dependências do frontend (`npm install`) se `frontend/node_modules` não existir.
4. Builda o frontend (`npm run build`) se `frontend/dist` não existir ou estiver desatualizado
   em relação a `frontend/src`.
5. Lança `backend/desktop_main.py` com o Python do venv.

### Pré-requisitos

| Componente | Necessário para |
|---|---|
| Python 3.13 + venv em `backend/.venv` (`pip install -r backend/requirements.txt`) | rodar o app (sempre) |
| Node.js + npm | build do frontend |
| GPU NVIDIA + driver | coluna GPU funcionar em tempo de execução |
| CUDA Toolkit (`nvcc`) em `$CUDA_HOME` (padrão `/usr/local/cuda-13.3`) | **compilar** a extensão CUDA (não precisa em runtime se o `.so` já estiver compilado) |
| WebKitGTK / PyGObject (`python3-gi`, `gir1.2-webkit2-*`) | a janela nativa do pywebview no Linux |

### Atalhos alternativos

- `backend/run_desktop.sh` — pula todas as checagens do `start.sh` e só executa
  `desktop_main.py` direto. Útil para reiniciar rápido durante desenvolvimento, quando você
  sabe que o build do frontend e a extensão CUDA já estão em dia.
- `backend/cuda_ext/build.sh` — recompila só a extensão CUDA manualmente (nvcc + g++).
- `cd frontend && npm run dev` — modo de desenvolvimento do Vite com hot-reload (abra
  `desktop_main.py` normalmente para ter a API; ou aponte um navegador comum para
  `http://127.0.0.1:8734` depois de rodar o app pelo menos uma vez, já que o servidor
  estático e a API sobem juntos no mesmo processo).

## O algoritmo

Cada iteração do K-Means (CPU e GPU) faz os mesmos dois passos matemáticos:

1. **Atribuição** — cada ponto é associado ao centróide mais próximo (menor distância²).
2. **Atualização** — cada centróide vira a média dos pontos atribuídos a ele.

O critério de parada (`backend/app/kmeans_runtime.py`) é: **as atribuições de todos os pontos
pararam de mudar** em relação à iteração anterior, respeitando um teto de segurança de
`MAX_ITERATIONS = 300` (evita loop infinito em casos patológicos, embora o algoritmo tenha
garantia teórica de convergência finita).

- **CPU** (`backend/app/kmeans_cpu.py`): paraleliza o passo de atribuição dividindo os pontos
  em `N` pedaços (`N` = núcleos lógicos da máquina) processados por um `ThreadPoolExecutor`,
  cada um calculando distâncias via `numpy`/`einsum`. O passo de atualização roda sequencial
  (é O(k), barato).
- **GPU** (`backend/cuda_ext/kmeans_kernel.cu`): 1 thread CUDA por ponto.
  - `assign_kernel` — cada thread testa os *k* centróides e grava o índice do mais próximo.
  - `accumulate_kernel` — cada thread soma a posição do seu ponto (`atomicAdd`) na soma do
    cluster a que pertence, e incrementa o contador daquele cluster.
  - `finalize_kernel` — 1 thread por **cluster** (não por ponto): divide soma acumulada pela
    contagem, produzindo o novo centróide.

## Posicionamento inicial dos centróides

Implementado em `backend/app/data_gen.py` (`init_centroids`). Existem **dois modos**,
escolhidos automaticamente conforme o contexto de uso (`dramatic_init = delay_ms > 0`,
decidido em `KMeansRuntime.configure`):

### 1. Modo didático/demonstração (`dramatic=True`) — quando há delay entre iterações

```python
rng.uniform(0, DOMAIN, size=(k, 2))
```

Sorteia os *k* centróides em posições **totalmente aleatórias dentro do domínio** (0–100 em
cada eixo), sem nenhuma relação com onde os pontos de fato estão. Isso é proposital: como o
objetivo aqui é *mostrar* visualmente os centróides se movendo e convergindo pouco a pouco
até os aglomerados de pontos, um início "de longe" produz uma animação mais didática — dá pra
ver claramente a trajetória de convergência ao longo das iterações.

### 2. Modo benchmark (`dramatic=False`) — quando `delay_ms = 0`

```python
idx = rng.choice(points.shape[0], size=k, replace=False)
points[idx]
```

Este é o método clássico **Forgy**: sorteia *k* pontos reais do próprio dataset (sem
repetição) para servir de centróide inicial. Por já nascerem dentro (ou perto) dos
aglomerados reais, o algoritmo converge em muito menos iterações — importante no modo
benchmark, onde o que se mede é desempenho puro, não a "encenação" da convergência.

> Nota sobre a semente: ambos os modos usam `np.random.default_rng(seed + 1)` — o `+1` só
> existe para que a geração dos centróides não reutilize exatamente a mesma sequência de
> números aleatórios usada por `generate_blob_points` (que gera os pontos com `seed`), evitando
> qualquer correlação indesejada entre "onde os pontos nascem" e "onde os centróides nascem".

CPU e GPU sempre recebem o **mesmo** array de centróides iniciais (mesmo `seed`), garantindo
que a comparação de desempenho entre as duas engines seja justa (RNF04 — resultados
equivalentes).

### Clusters vazios

Depois de qualquer iteração, é possível que um cluster fique sem nenhum ponto atribuído (mais
comum com *k* alto ou inicialização "dramática" distante dos dados). Isso é tratado em
`backend/app/empty_clusters.py`: para cada cluster vazio, o algoritmo reposiciona seu
centróide no ponto **mais distante** de qualquer centróide já existente — uma heurística
simples (parecida em espírito com a etapa de expansão do k-means++) que evita que aquele
cluster fique "morto" para sempre e força o algoritmo a considerar reparti-lo na próxima
iteração.

## Estatísticas e benchmark

- **CPU** (`backend/app/system_stats.py`, via `psutil`): threads usadas, núcleos lógicos, uso
  de CPU do processo e do sistema, uso de RAM.
- **GPU** (via `pynvml` + os kernels CUDA): nome da GPU, SM count, CUDA cores, block size,
  grid size, threads lançadas, uso de GPU/VRAM, tempo de cada kernel (`assign_ms`/`update_ms`).
- **Benchmark final** (`_compute_benchmark_result`): tempo total CPU/GPU, número de
  iterações, throughput (pontos processados/s) e speedup GPU/CPU.

## Estrutura de pastas

```
backend/
  desktop_main.py       # entrypoint: janela pywebview + servidor estático embutido
  run_desktop.sh         # atalho sem checagens (dev)
  app/
    desktop_api.py        # fachada js_api exposta ao frontend
    kmeans_runtime.py      # orquestra as engines CPU/GPU, loop de iterações, benchmark
    kmeans_cpu.py           # engine CPU (numpy + ThreadPoolExecutor)
    gpu_engine.py           # engine GPU (chama a extensão pybind11)
    data_gen.py             # geração de pontos + inicialização de centróides
    empty_clusters.py       # realocação de clusters vazios
    protocol.py             # (de)serialização binária dos frames
    source_view.py          # extrai/realça trechos de código-fonte para a UI (RF08)
    system_stats.py         # coleta de métricas via psutil/pynvml
    window_controller.py    # controles da janela nativa (mover, minimizar, maximizar)
  cuda_ext/
    kmeans_kernel.cu        # kernels CUDA reais (assign/accumulate/finalize)
    bindings.cpp             # ponte pybind11 (Python ↔ CUDA)
    build.sh                  # compila kernels + módulo nativo
frontend/
  src/
    App.tsx                 # layout principal (colunas CPU/GPU)
    components/               # Toolbar, ConfigModal, ScatterCanvas, CudaArchViz, CodeViewer...
    hooks/useKMeansBridge.ts # bridge de comandos + polling de frames
    store/useKMeansStore.ts  # estado global (Zustand)
start.sh                  # script de inicialização completo (ver acima)
```

## Limitações conhecidas / próximos passos

- `seed`, `step_mode` (modo passo a passo) e `block_size` já são suportados de ponta a ponta
  pelo backend, mas ainda **não têm controle na UI** — hoje só `num_points`, `k` e `delay_ms`
  são editáveis pelo `ConfigModal`. `Config.seed`/`step_mode`/`block_size` usam os defaults
  definidos em `frontend/src/store/useKMeansStore.ts`.
- Sem GPU/CUDA Toolkit disponíveis, o app funciona normalmente mostrando só a coluna CPU
  (checagem automática, sem necessidade de configuração manual).
