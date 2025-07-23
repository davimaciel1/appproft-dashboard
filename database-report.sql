-- Relatório do Banco de Dados AppProft
-- Execute este script no PostgreSQL do Coolify

-- 1. Informações gerais do banco
SELECT 
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    NOW() as report_date;

-- 2. Total de tabelas
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 3. Lista de todas as tabelas com contagem de registros
CREATE TEMP TABLE table_counts (
    table_name text,
    row_count bigint,
    table_size text
);

DO $$
DECLARE
    r RECORD;
    count_result bigint;
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.table_name) INTO count_result;
        INSERT INTO table_counts VALUES (
            r.table_name, 
            count_result,
            pg_size_pretty(pg_total_relation_size(r.table_name::regclass))
        );
    END LOOP;
END $$;

-- Mostrar resultados
SELECT 
    table_name as "Tabela",
    row_count as "Registros",
    table_size as "Tamanho"
FROM table_counts
ORDER BY row_count DESC;

-- 4. Resumo total
SELECT 
    SUM(row_count) as "Total de Registros",
    COUNT(*) as "Total de Tabelas"
FROM table_counts;

-- 5. Estrutura de cada tabela
\dt+

-- 6. Verificar índices
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_total_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Limpar tabela temporária
DROP TABLE table_counts;