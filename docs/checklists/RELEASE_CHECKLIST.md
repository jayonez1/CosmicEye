# Чек-лист релиза

Следуйте этой последовательности для каждого релиза.

## Перед релизом

- [ ] Обновите версию в `package.json` и `src/config.ts` (константа `VERSION`)
- [ ] Обновите `CHANGELOG.md`, включив все изменения с прошлого релиза
- [ ] Убедитесь, что все тесты проходят: `npm run test`
- [ ] Убедитесь, что нет ошибок линтера: `npm run lint`
- [ ] Убедитесь, что проходит проверка типов: `npm run typecheck`
- [ ] Соберите `dist`: `npm run build`
- [ ] Проверьте, что `dist/` содержит `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`

## Проверьте содержимое пакета

```bash
npm pack --dry-run
```

Проверьте, что включены только нужные файлы:
- `dist/`
- `README.md`
- `LICENSE`
- `package.json`

`src/`, `tests/`, `.internal/` и файлы конфигурации не должны попадать в tarball.

## Проверьте exports

```bash
# Во временной директории:
npm pack
tar -tzf cosmic-eye-*.tgz
```

Убедитесь, что `exports` в `package.json` указывают на существующие файлы в `dist/`.

## Публикация

```bash
npm login          # если вы ещё не вошли
npm publish        # публикует в npm registry
```

Для scoped-пакетов или первой публикации:
```bash
npm publish --access public
```

## После публикации

- [ ] Создайте git-тег: `git tag v0.1.0 && git push origin v0.1.0`
- [ ] Убедитесь, что пакет доступен: `npm info cosmic-eye`
- [ ] Проверьте установку в чистом проекте: `npm install cosmic-eye`
