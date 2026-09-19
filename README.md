# Vacancy Workflow Suite

Userscript único para os fluxos de vagas CIEE, ESPRO TAQE, ISBET, IEL Bahia e Start Carreiras exportados do Automa.

## Recursos

- Preenche filtros específicos de cada plataforma, sempre sob acionamento manual.
- CIEE: cidade Salvador para estágio ou aprendiz.
- IEL Bahia: Salvador, Psicologia para estágio, e categoria de aprendiz quando escolhida.
- ESPRO TAQE: cidade Salvador.
- ISBET: Bahia, Salvador e aprendiz.
- Salva até 50 links de vagas visíveis em `Alertas capturados` da planilha `$$alertasCentral`, inclusive no Start Carreiras.

## Configuração

Instale `vacancy-workflow-suite.user.js` no Violentmonkey. No menu do userscript, escolha **Configurar Workflow Sheets Adapter** e informe a URL `/exec` e o token do adapter. Ambos ficam no armazenamento local do gerenciador de userscripts e não devem ser publicados.

A captura não envia candidatura, não agenda entrevista e não preenche credenciais. O script só altera filtros após clique explícito e exige confirmação antes de salvar vagas.
