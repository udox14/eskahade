-- READ ONLY. Operator must verify meta.rows_written=0 for every result.
-- Compare complete schema to the reviewed hotfix baseline; schema drift is STOP.
SELECT type,name,tbl_name,sql FROM sqlite_schema
WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
ORDER BY type,name;
SELECT name,type,"notnull" FROM pragma_table_info('users') ORDER BY cid;
SELECT name,type,"notnull" FROM pragma_table_info('portal_ortu_credentials') ORDER BY cid;
-- Counts only, never copy production identities or password material.
SELECT COUNT(*) AS invalid_roles_json FROM users
WHERE roles IS NOT NULL AND roles<>'' AND json_valid(roles)=0;
SELECT COUNT(*) AS missing_role FROM users
WHERE COALESCE(role,'')='' AND COALESCE(roles,'[]') IN ('','[]');
