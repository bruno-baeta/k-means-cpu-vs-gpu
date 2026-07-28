K-Means CUDA Visualizer

Objetivo:
Desenvolver uma aplicação web para demonstrar visualmente a execução do algoritmo K-Means em CPU e GPU (CUDA), permitindo comparar desempenho, utilização de recursos e funcionamento interno da paralelização.

Requisitos Funcionais
RF01 - Execução do algoritmo
Executar K-Means em CPU.
Executar K-Means em GPU utilizando CUDA.
RF02 - Comparação em tempo real
Exibir CPU e GPU lado a lado.
Iniciar ambas simultaneamente.
Permitir pausar e reiniciar.
RF03 - Visualização dos clusters
Exibir os pontos em um gráfico 2D.
Exibir centróides.
Mostrar a movimentação dos centróides durante as iterações.
Permitir velocidade normal ou modo passo a passo.
RF04 - Configuração
Número de pontos.
Quantidade de clusters (K).
Seed aleatória.
Delay entre iterações.
Modo Demonstração / Benchmark.
RF05 - Estatísticas da CPU
Tempo por iteração.
Tempo total.
Número de threads.
Uso da CPU.
Uso de memória RAM.
RF06 - Estatísticas da GPU
Modelo da GPU.
CUDA Cores.
Streaming Multiprocessors.
Block Size.
Grid Size.
Threads lançadas.
Uso da GPU.
Uso de VRAM.
Tempo dos kernels.
Tempo total.
RF07 - Visualização da arquitetura CUDA
Exibir Grid.
Exibir Blocks.
Exibir Threads.
Destacar visualmente como os pontos são distribuídos entre as threads.
RF08 - Visualização do código
Exibir implementação da CPU.
Exibir implementação CUDA.
Destacar a fase atual do algoritmo durante a execução.
RF09 - Benchmark

Ao finalizar a execução apresentar:

Tempo CPU.
Tempo GPU.
Speedup.
Número de iterações.
Throughput (pontos/s).
Requisitos Não Funcionais
RNF01

A interface deverá ser responsiva e executada em navegador.

RNF02

A renderização deverá suportar centenas de milhares de pontos sem perda significativa de desempenho.

RNF03

A comunicação entre backend e frontend deverá ocorrer em tempo real (WebSocket).

RNF04

As implementações de CPU e GPU deverão produzir resultados equivalentes.

RNF05

O sistema deverá permitir execução em modo didático e modo benchmark.

Diferenciais
Comparação visual CPU × CUDA.
Código destacado conforme a execução.
Estatísticas reais da GPU.
Visualização da arquitetura Grid → Block → Thread.
Dashboard de desempenho.
Interface moderna.
O que eu faria para deixar esse projeto memorável

Eu daria um nome mais "de produto", por exemplo:

CUDA Vision
ClusterScope
ParallelLab
CUDA Insight
ClusterViz
KMeans Studio
CUDA Explorer