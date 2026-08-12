# Acesso à conta de teste teste99674@gmail.com

Definir uma senha conhecida para essa conta de teste, para você entrar direto pela tela de login.

## O que será feito

1. Definir a senha da conta `teste99674@gmail.com` como `Teste@123456`.
2. Garantir que a conta esteja confirmada e sem campos internos pendentes (mesmo ajuste feito na conta admin, que impedia o login de contas criadas manualmente).
3. Validar o login de fato, chamando o serviço de autenticação com esse e-mail e senha, e confirmar que retorna sessão válida.

## Como você entra depois

- Tela de login → e-mail `teste99674@gmail.com` → senha `Teste@123456`.
- Se quiser, você pode trocar a senha depois em Conta → Alterar senha.

## Detalhe técnico

Atualização da senha via `crypt(..., gen_salt('bf'))` na tabela de usuários do Auth, normalização dos campos de token nulos para string vazia e teste de login pelo endpoint `/auth/v1/token?grant_type=password`.
