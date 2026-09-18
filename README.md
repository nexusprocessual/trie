# Triê — reprodução local

Cópia das páginas públicas de https://triesolucoes.com, preservando HTML, CSS, imagens, ícones, fontes, disposição responsiva, artigos, categorias, carrosséis e modais de vídeo.

## Executar

Requer Node.js 20 ou superior. Não há dependências para instalar.

```sh
npm run dev
```

Abra http://localhost:4173. Para escolher outra porta, configure a variável `PORT`.

Se o npm não estiver disponível, execute diretamente `node server.mjs`. Os equivalentes para verificação e exportação são `node --test tests/*.test.mjs` e `node scripts/build.mjs`.

## Alterar o WhatsApp

Abra http://localhost:4173/admin, digite o DDD e o número brasileiro e clique em **Salvar alterações**. O campo aceita telefone com ou sem formatação, prefixo +55 e número 0800. Há uma prévia do destino antes de salvar.

A configuração fica em `data/settings.json`, fora da pasta pública, e permanece após reiniciar o servidor. Todos os links de WhatsApp das páginas usam o número configurado, preservando a mensagem inicial. Páginas já abertas atualizam o destino ao voltar para a aba ou receber a alteração em outra aba. O telefone do rodapé mostra o mesmo número e abre o WhatsApp.

Este painel é local: não requer senha e só aceita acesso por localhost neste computador. Alterações exigem token de proteção e origem local. Antes de disponibilizar o painel na internet, implemente autenticação administrativa. A edição em `/admin` requer o servidor Node em execução; a exportação estática em `dist/` usa o número salvo no momento do build e não oferece edição persistente.

```sh
npm test
npm run build
```

`public/` contém os arquivos editáveis do site. `routes.json` mapeia as páginas. `dist/` recebe a versão estática exportada. O servidor local resolve também as rotas sem extensão e parâmetros de paginação capturados.

## Supabase e aba Acessos

1. Crie um projeto no [Supabase](https://supabase.com) e rode `supabase/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API). A chave fica só no servidor.
3. Reinicie o servidor. O número do WhatsApp passa a ser salvo na tabela `site_settings`, e cada página aberta é registrada em `site_visits`.

Em `/admin`, a aba **Acessos** lista horário, IP, cidade, página e navegador de cada visita, com filtro e totais. A cidade vem dos cabeçalhos da hospedagem (Vercel/Cloudflare) ou de uma consulta a `ipwho.is`. Sem o `.env`, o painel usa `data/settings.json` e guarda os acessos só na memória.

Atrás de proxy ou hospedagem, defina `TRUST_PROXY=true` para registrar o IP real do visitante; `HOST=0.0.0.0` aceita conexões externas. Registrar IP e localização é tratamento de dados pessoais: informe isso na política de privacidade (LGPD).

## Escopo e integrações

- Os recursos visuais foram baixados e são servidos localmente. O relatório `mirror-report.json` registra a quantidade de páginas, recursos e eventuais falhas na origem.
- Os vídeos exibem capas locais e botão de reprodução, inclusive nos depoimentos. O player do YouTube é carregado ao clicar e só substitui a capa depois de confirmar que está pronto. Se o navegador bloquear o player, a capa permanece visível com uma mensagem e o link para assistir no YouTube. Reprodução requer internet. Links de WhatsApp, telefone, mapas e redes sociais conservam seus destinos originais.
- A primeira tela da calculadora é a original. As etapas posteriores da origem exigem envio de cadastro e acesso ao backend privado. Esta cópia implementa uma **demonstração local**, explicitamente identificada, com validação e estimativa ilustrativa de até 50%; não reproduz a regra privada de cálculo nem cria propostas ou cadastros.
- Dados preenchidos permanecem apenas na página e não são persistidos nem enviados. A consulta de contratos informa a necessidade de integração, sem simular um resultado real.
- Analytics, rastreadores e tokens de sessão do domínio original foram removidos. O código administrativo, CRM, banco de dados e regras privadas não podem ser obtidos pelas páginas públicas.

Para reproduzir as integrações reais, será necessário fornecer o código do backend ou a documentação e credenciais das APIs autorizadas. Esta entrega não publica nem altera o site original.

## Atualizar a captura pública

`python scripts/mirror.py` coleta novamente as páginas públicas vinculadas e seus recursos. Isso sobrescreve o HTML e os recursos capturados; preserve suas alterações antes de executar. As adaptações locais ficam em `public/local.js`.

`python scripts/video-posters.py` atualiza as capas locais dos vídeos incorporados.
