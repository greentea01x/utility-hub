import { readFile, readdir } from 'node:fs/promises';

export async function migrationSql() {
  const directory = new URL('./migrations/', import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const statements = await Promise.all(
    names.map((name) => readFile(new URL(name, directory), 'utf8')),
  );
  return statements.join('\n');
}

export async function schemaSql() {
  return `${await readFile(new URL('./schema.sql', import.meta.url), 'utf8')}\n${await migrationSql()}`;
}
