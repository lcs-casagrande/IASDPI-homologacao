# Fixture de regressão — NÃO instalar no Supabase

Cópia estrutural dos scripts 001–004 do núcleo e 001–005/006 do piloto isolado
já desenvolvidos no repositório IASDPI (`/workspace/iasdpi-lote6/database`).
A função de nomes confirmados foi esvaziada para não carregar nomes reais nesta fixture.
Não inclui a carga de pessoas R2. `test_profiles_db.py` cria identidades sintéticas e
uma restrição pública equivalente à regra informada na issue #1; não representa
captura da definição real. A comparação exata remota continua pendente de autorização.

Só executar em PostgreSQL 17 descartável **sem rede**. Os DROP e substituições dos
scripts antigos pertencem exclusivamente à instalação dessa fixture local; não
são o pacote incremental proposto. Para revisão real: `supabase/migrations/`.
