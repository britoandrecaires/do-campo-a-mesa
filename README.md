# Do Campo à Mesa

**Marketplace digital de produtores locais com leilões em tempo real**

Trabalho prático individual desenvolvido no âmbito da unidade curricular de **Desenvolvimento Web e para a Cloud**, do Mestrado em Engenharia Informática da ESTG-IPVC.

## 1. Descrição do projeto

O **Do Campo à Mesa** é uma plataforma web que aproxima produtores locais dos consumidores, permitindo comercializar produtos agrícolas e regionais através de um catálogo digital e de leilões em tempo real.

A aplicação contempla diferentes perfis de utilização: visitante, comprador, produtor e administrador.

O objetivo é disponibilizar uma solução completa, responsiva e alojada na cloud, integrando uma Single Page Application (SPA), uma API REST, uma base de dados NoSQL, comunicação em tempo real e armazenamento de imagens.

## 2. Aplicação online

| Serviço               | Endereço                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Marketplace            | https://do-campo-a-mesa.pages.dev                                                      |
| API REST               | https://dcm-api-estg-2026-a3gpd6bjcucxa7a6.austriaeast-01.azurewebsites.net            |
| Documentação Swagger | https://dcm-api-estg-2026-a3gpd6bjcucxa7a6.austriaeast-01.azurewebsites.net/api-docs   |
| Health check           | https://dcm-api-estg-2026-a3gpd6bjcucxa7a6.austriaeast-01.azurewebsites.net/api/health |

## 3. Tecnologias utilizadas

### Frontend

- React 18 — desenvolvimento da SPA
- Vite — ambiente de desenvolvimento e compilação
- React Router — navegação entre páginas
- Context API e Hooks — gestão de estado
- Bootstrap 5 — componentes e grelha responsiva
- SASS/SCSS — organização e personalização dos estilos
- Socket.IO Client — comunicação em tempo real

### Backend

- Node.js — ambiente de execução JavaScript
- Express.js — implementação da API REST
- Mongoose — modelação e acesso ao MongoDB
- Socket.IO — eventos e salas de leilão
- JSON Web Token (JWT) — autenticação e autorização
- bcryptjs — hash de passwords
- Multer — receção de ficheiros
- Swagger UI e OpenAPI 3 — documentação da API

### Cloud e armazenamento

- Azure App Service — alojamento da API Node.js
- Cloudflare Pages — alojamento do frontend React
- MongoDB Atlas — base de dados documental gerida
- Azure Blob Storage — armazenamento das fotografias
- GitHub — controlo de versões do código

## 4. Funcionalidades implementadas

### Compradores

- Registo e autenticação.
- Consulta do catálogo de produtos.
- Pesquisa e filtros por categoria, preço, época e produção biológica.
- Consulta dos perfis dos produtores.
- Carrinho de compras e criação de encomendas.
- Consulta do histórico e estado das encomendas.
- Participação em leilões em tempo real.
- Avaliação de produtos e produtores após a entrega.
- Denúncia de avaliações.

### Produtores

- Registo sujeito a aprovação administrativa.
- Gestão do catálogo de produtos.
- Upload e substituição de fotografias.
- Gestão de stock e consulta de indicadores.
- Criação de leilões.
- Consulta das encomendas recebidas.
- Atualização dos estados das encomendas.

### Administrador

- Consulta de estatísticas da plataforma.
- Aprovação ou rejeição de produtores.
- Consulta de avaliações denunciadas.
- Moderação de avaliações, permitindo mantê-las públicas ou ocultá-las.

### Leilões em tempo real

- Salas individuais de leilão.
- Autenticação de participantes com JWT.
- Contagem de participantes.
- Atualização automática de preços e histórico.
- Validação das licitações no servidor.
- Operações atómicas e transações MongoDB.
- Encerramento automático e identificação do vencedor.
- Criação automática de uma encomenda para a licitação vencedora.

## 5. Arquitetura

A plataforma utiliza uma arquitetura cliente-servidor com serviços distribuídos na cloud.

```text
          Utilizador / Browser
                  |
                  v
       Frontend React + Vite
          Cloudflare Pages
                  |
          HTTPS / REST / Socket.IO
                  |
                  v
        Node.js + Express
          Azure App Service
             /         \
            v           v
      MongoDB Atlas   Azure Blob Storage
       Dados NoSQL       Fotografias
```

A API REST é responsável pela autenticação, validações, regras de negócio e persistência dos dados.

O Socket.IO disponibiliza a comunicação bidirecional necessária aos leilões e às notificações de encomendas.

## 6. Estrutura do repositório

```text
do-campo-a-mesa/
├── api/
│   ├── openapi.yaml
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── sockets/
│       ├── services/
│       └── seed/
├── web/
│   ├── package.json
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       └── styles/
└── docs/
    └── relatorio.md
```

## 7. Instalação e execução local

### Pré-requisitos

- Node.js 20 ou superior
- npm
- MongoDB Atlas ou uma instância MongoDB compatível
- Git

### Backend

No terminal PowerShell:

```powershell
cd api
Copy-Item .env.example .env
npm install
npm run dev
```

Configurar o ficheiro `api/.env` com as variáveis necessárias:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=<ligacao_mongodb>
JWT_SECRET=<segredo_seguro>
JWT_EXPIRES_IN=2h
CLIENT_URL=http://localhost:5173
```

O armazenamento local de fotografias é utilizado quando não existe uma ligação configurada ao Azure Blob Storage.

Para utilizar Azure Blob Storage, configurar também `STORAGE_CONN` e, opcionalmente, `STORAGE_CONTAINER`.

### Frontend

Num segundo terminal PowerShell:

```powershell
cd web
Copy-Item .env.example .env
npm install
npm run dev
```

Configuração do ficheiro `web/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_USAR_DADOS_SIMULADOS=false
```

A aplicação estará disponível em:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Swagger UI: http://localhost:3000/api-docs

**Nota:** o comando `npm run seed` destina-se exclusivamente a ambientes de teste e pode eliminar dados existentes nas coleções utilizadas pelo script. Não deve ser executado sobre a base de dados de produção.

## 8. API REST

A API encontra-se organizada pelos seguintes recursos:

| Recurso            | Funcionalidade                    |
| ------------------ | --------------------------------- |
| `/api/auth`      | Registo, autenticação e sessão |
| `/api/products`  | Gestão e pesquisa de produtos    |
| `/api/producers` | Perfis dos produtores             |
| `/api/orders`    | Encomendas e estados              |
| `/api/auctions`  | Criação e consulta de leilões  |
| `/api/reviews`   | Avaliações e denúncias         |
| `/api/admin`     | Administração e moderação     |

A documentação interativa está disponível através do Swagger UI em `/api-docs`.

## 9. Segurança

A aplicação inclui:

- Autenticação através de JWT.
- Passwords armazenadas com hash bcrypt.
- Controlo de acesso por papéis no backend.
- Validação de dados e permissões nas operações.
- Verificação da titularidade de produtos e encomendas.
- Configuração de segredos através de variáveis de ambiente.
- Comunicação HTTPS nos serviços publicados.
- Validação do formato e do tamanho das fotografias enviadas.

## 10. Testes funcionais realizados

Foram efetuados testes manuais no ambiente publicado, incluindo:

- Ligação da API ao MongoDB Atlas.
- Carregamento do catálogo de produtos.
- Upload de fotografias para Azure Blob Storage.
- Participação simultânea de dois compradores num leilão.
- Atualização das licitações através do Socket.IO, sem recarregar a página.
- Encerramento automático e identificação do vencedor.
- Criação automática da encomenda vencedora.
- Atualização da encomenda até ao estado «Entregue».
- Avaliações de produtos e produtores.
- Denúncia e apresentação de avaliações no painel administrativo.

Estes testes demonstram os principais fluxos funcionais. Os testes automatizados e a validação de licitações verdadeiramente concorrentes são aspetos a aprofundar.

## 11. Limitações e melhorias futuras

- Reforçar os testes automatizados e de concorrência.
- Melhorar a persistência do carrinho entre sessões.
- Reforçar a proteção contra tentativas repetidas de autenticação.
- Otimizar a escalabilidade e disponibilidade dos leilões.
- Automatizar adicionalmente o deployment e os processos de CI/CD.
- Melhorar a monitorização, os logs e a observabilidade.

## 12. Documentação académica

O relatório técnico descreve a arquitetura, as decisões tecnológicas, os modelos de dados, a segurança, a consistência dos leilões e a infraestrutura cloud.

A utilização de bibliotecas e assistentes de inteligência artificial será declarada no relatório académico, de acordo com as regras do trabalho.
