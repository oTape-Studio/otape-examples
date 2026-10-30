# oTAPE examples

Small, readable implementations of the [oTAPE](https://github.com/otape-studio/otape-spec) file format, meant
as a starting point for developers.

oTAPE is an open digital cassette format: one `.otape` file holds one cassette, with two sides of continuous
audio, artwork, packaging, write protection and history. The specification promises that "a developer can
write a basic player in an afternoon". These examples show how.

## Examples

| Example | Language | Level | What it shows |
| --- | --- | --- | --- |
| [`javascript/simplest-player`](javascript/simplest-player) | JavaScript (browser) | Minimal | Reading the container, validating the manifest, playing, winding and flipping a tape. No dependencies, no build step. |
| [`typescript/web-player`](typescript/web-player) | TypeScript (browser) | Complete | An embeddable `<otape-player>` element: streaming playback, the cassette drawn from its manifest with animated reels, artwork, J-card, rights, theming and translation. Vite, Vitest, ESLint. |

Examples come in two levels:

- **Minimal** examples are for reading. They do the least needed to be correct, in as little code as possible.
- **Complete** examples are for using. They cover what a real application needs and are ready to deploy, with the
  tooling a professional project in that language would have.

Each example has its own README with instructions to run and test it.

## Principles

Every example in this repository:

- **is honest about its scope.** It says which parts of the specification it implements and what it leaves out;
- **cites the specification.** Rules in the code carry their section number (`§7.3`), so you can check them
  against [oTAPE-1.0.md](https://github.com/otape-studio/otape-spec/blob/main/oTAPE-1.0.md);
- **is self-contained.** One folder, its own README and tests, no shared code between examples;
- **keeps dependencies in proportion.** Minimal examples have none; complete ones use only the standard tooling
  of their ecosystem, and only for development;
- **is tested** against the example files of the specification, including the invalid ones a conforming
  reader must reject.

## Layout

```
otape-examples/
├── README.md
├── LICENSE
└── <language>/
    └── <example>/
        ├── README.md
        ├── src/
        ├── test/
        └── examples/      sample .otape files, if the example needs them
```

## Contributing

New examples are welcome: another language, or another kind of reader from §16 of the specification (a
validator, a recorder, an editor). Keep them small, follow the principles above, and add a row to the table.

## Related

| Repository | Contents |
| --- | --- |
| [otape-spec](https://github.com/otape-studio/otape-spec) | The specification, JSON Schema, geometry, templates, example cassettes and a validator |
| [oTape Studio](https://github.com/otape-studio/otape-studio) | The reference implementation for macOS: a full recorder and player |

## Licence

The code in this repository is released under the [MIT License](LICENSE).

Files copied from the specification repository keep their original licence,
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) © 2026 Jan Osio: the example cassettes in
`*/examples/` and the manifests in `*/test/fixtures/`.

Implementing oTAPE itself needs no licence: anyone may read and write `.otape` files, free or commercial.
