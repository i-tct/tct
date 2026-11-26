# ManyFile translations

ManyFile ships in English only. The languages listed in `languages.json` can be downloaded from Settings → Language;
until a text is translated, it shows in English.

## `languages.json`

```json
{
  "version": 1,
  "languages": [
    { "code": "sw", "name": "Swahili", "native": "Kiswahili", "rtl": false, "version": 1, "file": "strings-sw.xml", "sha256": "…" },
    { "code": "ar", "name": "Arabic", "native": "العربية", "rtl": true, "version": 1, "file": "strings-ar.xml", "sha256": "…" }
  ]
}
```

- `code`: the language code (`sw`, `fr`, `es`, `de`, `ar`, `pt-BR`…).
- `name` / `native`: the language's name in English and in itself.
- `rtl`: `true` for languages written right to left (Arabic, Hebrew, Persian, Urdu): ManyFile mirrors its layout for them.
- `version`: raise it when the file changes, so phones download it again.
- `file`: the file in this folder.
- `sha256`: the file's SHA-256 (`sha256sum strings-sw.xml`), checked after downloading.

## `strings-<code>.xml`

Start from **`strings-en.xml`**, ManyFile's English texts. Copy it to `strings-<code>.xml` (`strings-sw.xml` for
Swahili), translate the texts and keep everything else: the `name`s, and placeholders such as `%s`, `%d` or `%1$s`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="t_d6fe3d8e30">Ufikiaji wa haraka</string>
    <string name="t_3fd293a9d6">%s kati ya %s</string>
</resources>
```

- Each `name` comes from the English text itself, so it changes when that text changes: a changed text shows in
  English until its translation is updated.
- A text left out shows in English, so a translation can be published before it is finished.
- Placeholders can change places: `%2$s … %1$s` puts the second value first. A text whose placeholders don't fit is
  shown in English.
- Android's escapes: `\'` for `'`, `\"` for `"`, `\n` for a new line; `&amp;` `&lt;` `&gt;` for `&` `<` `>`.
- `strings-en.xml` is made from ManyFile's code and grows with each version: compare it with your file to see what's new.

## Trying a translation

On the phone: **Settings → Language → Try a translation from a file…**, and pick your `strings-<code>.xml`. ManyFile
shows itself in it at once (right to left for Arabic, Hebrew, Persian, Urdu…). Nothing needs publishing for that.

## Publishing one

1. Put `strings-<code>.xml` in this folder.
2. Add it to `languages.json` with its SHA-256 (`sha256sum strings-<code>.xml`) and `"version": 1`.
3. When the file changes later, raise its `version` and update its `sha256`: phones using it download it again.
