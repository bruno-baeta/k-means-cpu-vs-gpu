K-Means CUDA Visualizer

Objetivo:
Aplicativo desktop que demonstra visualmente a execução do algoritmo K-Means em CPU e GPU (CUDA) simultaneamente, lado a lado, permitindo comparar desempenho, utilização de recursos e o funcionamento interno da paralelização (grid → block → thread).

Nome do projeto já definido: K-Means CUDA Visualizer (nome final, usado no README, na pasta e na janela do app — não é mais um tópico em aberto).

Mudança de arquitetura importante: o escopo original previa uma aplicação web servida por navegador com WebSocket. O projeto pivotou para um app desktop nativo (pywebview/WebKitGTK) com o "backend" rodando embutido no mesmo processo — sem servidor remoto, sem WebSocket. Os requisitos abaixo já refletem essa decisão. Detalhes completos de arquitetura, algoritmo e inicialização de centróides estão no README.md — este arquivo foca no status de cada requisito.

Legenda de status: ✅ implementado · ⚠️ parcial/implementado com ressalva · 🔜 planejado, não feito

Requisitos Funcionais

RF01 - Execução do algoritmo ✅
- Executar K-Means em CPU (backend/app/kmeans_cpu.py, multi-thread via ThreadPoolExecutor).
- Executar K-Means em GPU utilizando CUDA (backend/cuda_ext/kmeans_kernel.cu, kernels reais via pybind11).

RF02 - Comparação em tempo real ✅
- CPU e GPU lado a lado (App.tsx renderiza duas EngineColumn).
- Ambas iniciam simultaneamente (KMeansRuntime.start() sobe uma thread por engine).
- Pausar, retomar e reiniciar implementados (Toolbar + KMeansRuntime.pause/resume/reset).

RF03 - Visualização dos clusters
- Pontos em gráfico 2D ✅ (ScatterCanvas.tsx).
- Centróides exibidos ✅.
- Movimentação dos centróides ao longo das iterações ✅ (trail no useKMeansStore).
- Velocidade normal (via slider de delay) ✅.
- Modo passo a passo ⚠️: suportado ponta a ponta no backend (`step_mode`, `KMeansRuntime.step()`), mas ainda sem botão/controle na UI (Toolbar só tem Iniciar/Pausar/Retomar/Reiniciar).

RF04 - Configuração
- Número de pontos ✅ (ConfigModal).
- Quantidade de clusters K ✅ (ConfigModal).
- Delay entre iterações ✅ (slider no ConfigModal).
- Seed aleatória ⚠️: suportada no backend (`Config.seed`, default 42), sem input na UI ainda.
- Modo Demonstração / Benchmark ⚠️: não existe um seletor explícito de "modo" — o comportamento é inferido de `delay_ms` (`delay_ms > 0` → inicialização "dramática" dos centróides para fins didáticos; `delay_ms == 0` → inicialização Forgy, focada em velocidade de convergência para benchmark). Ver README para detalhes.

RF05 - Estatísticas da CPU ✅
- Tempo por iteração, tempo total, número de threads usadas, uso de CPU (processo e sistema) e uso de RAM — todos coletados via psutil (backend/app/system_stats.py) e exibidos no StatsPanel.

RF06 - Estatísticas da GPU ✅ (quando GPU/CUDA disponíveis; senão a coluna GPU some e o app segue só com CPU)
- Modelo da GPU, CUDA Cores, SM count, Block Size, Grid Size, Threads lançadas, uso de GPU, uso de VRAM, tempo dos kernels (assign/update) e tempo total — via extensão CUDA + pynvml.

RF07 - Visualização da arquitetura CUDA ✅
- Grid, Blocks e Threads exibidos (CudaArchViz.tsx), com destaque visual de quais threads processam pontos reais vs. threads ociosas (sobra do último block).

RF08 - Visualização do código ✅
- Implementação da CPU e implementação CUDA exibidas (CodeViewer.tsx + backend/app/source_view.py).
- Fase atual (atribuição vs. atualização) destacada durante a execução via ranges de linha (`assign_range`/`update_range`).

RF09 - Benchmark ✅
- Ao finalizar, apresenta tempo CPU, tempo GPU, speedup, número de iterações (CPU e GPU podem convergir em números diferentes) e throughput (pontos/s) — `KMeansRuntime._compute_benchmark_result`.

Requisitos Não Funcionais

RNF01 (revisado)
A interface é a mesma SPA React responsiva de antes, mas empacotada e executada como janela desktop nativa (pywebview sobre WebKitGTK), não mais "executada em navegador" como app web público. Não requer servidor remoto nem conexão de rede.

RNF02 ⚠️ a validar
O backend aceita até 2.000.000 de pontos por configuração (`MAX_POINTS`), mas não há benchmark formal registrado de performance de renderização do frontend nesse volume — recomenda-se validar antes de divulgar esse número como garantido.

RNF03 (revisado, mudou de fato)
Não usa WebSocket. Comandos (configure/start/pause/step/reset) vão direto de JS para Python via `js_api` do pywebview (chamada síncrona, sem round-trip de rede). O estado de posições (pontos/centróides/atribuições) é lido por polling em `requestAnimationFrame`, via HTTP GET binário local (`/api/points`, `/api/frame/cpu`, `/api/frame/gpu`) servido pelo mesmo processo. Na prática entrega atualização "em tempo real" percebida (~60fps de polling), só que por um mecanismo diferente do especificado originalmente.

RNF04 ✅
CPU e GPU recebem os mesmos pontos e os mesmos centróides iniciais (mesma seed) e aplicam a mesma lógica de atribuição/atualização/critério de convergência, garantindo resultados equivalentes entre as duas engines.

RNF05 ⚠️
Modo didático e modo benchmark existem em termos de comportamento (ver RF04), mas hoje são um efeito colateral do valor de `delay_ms` em vez de um toggle explícito na UI.

Diferenciais (implementados)
- Comparação visual CPU × CUDA lado a lado. ✅
- Código destacado conforme a fase de execução. ✅
- Estatísticas reais da GPU (pynvml + CUDA device props). ✅
- Visualização da arquitetura Grid → Block → Thread. ✅
- Dashboard de desempenho / benchmark final. ✅
- Interface moderna (React 19 + Zustand + lucide-react). ✅

Pendências conhecidas (para próxima iteração de requisitos)
- Expor seed, step_mode e block_size na UI (ConfigModal).
- Decidir se vale formalizar um seletor explícito "Demonstração / Benchmark" em vez de inferir do delay_ms.
- Rodar e documentar um teste de carga real para validar RNF02 (centenas de milhares de pontos).
