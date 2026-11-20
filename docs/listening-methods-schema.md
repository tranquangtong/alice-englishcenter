# IELTS GT Listening skill-training data

The Listening index exposes four `methods` entries alongside `tests`. A method entry requires `id`, `title`, `intro` (path to its Markdown), `file` (path to its exercises JSON), and an ordered `exercises` array of `{ "id", "title" }` objects. Keep that array in sync with the full exercises. Method URLs are `#/ielts-gt/listening/<method>` and `#/ielts-gt/listening/<method>/<exercise-id>`.

## JSON contract

Each method's `exercises.json` is an array. An exercise requires these fields.

| Field | Type and meaning |
| --- | --- |
| `id` | Unique slug within the method. IDs use lowercase ASCII letters and digits, with optional hyphen-separated segments. |
| `format` | Format ID in the table below. |
| `title`, `level`, `instructions` | Nonempty strings shown to learners. Use Vietnamese for instructions and a display label such as `Band 5.0` for level. |
| `clips` | Nonempty array of clips. Each clip groups its own recording and prompts. |

Each clip requires `id` (slug, unique within exercise), `audio` (exact relative path `assets/audio/listening/methods/<method>/<exercise-id>-<clip-id>.mp3`), `script`, `items`, and `source`. The `script` is an ordered, nonempty array of `{ "speaker": string, "voice": string, "text": string }` lines. Original audio uses a voice key from `VOICES` in [listening-core.js](../assets/js/listening-core.js). Tatoeba uses the speaker username in `voice`. The page reveals the script after scoring.

Each `items` entry requires `id` (slug, unique across the exercise), `prompt`, `answer`, and `explanation` (nonempty strings). Choice items require `choices`, an array of at least two `{ "id": slug, "label": string }` objects. Set `answer` to the correct choice ID. Text items can add `variants`, an array of acceptable strings, and `rules`, an object with the optional keys below.

| Method | Format | Item and clip requirements |
| --- | --- | --- |
| `dictation` | `number-spelling` | Text items for names, dates, prices, codes or phone numbers. Add rules and variants per answer. |
| `dictation` | `gap-dictation` | Text items with a visible blank (`___`) in the prompt. |
| `dictation` | `sentence-dictation` | One complete spoken sentence or short passage per text item. Use multiple clips for independent recordings. |
| `paraphrase` | `trap-spotter` | Exactly two choice items per clip in order. Set `role` to `fact` on the first and `cue` on the second. |
| `paraphrase` | `paraphrase-match` | Choice items with reworded statements as labels. |
| `paraphrase` | `transcript-highlight` | Choice items and a clip-level `highlights` array of `{ "line": integer, "text": string, "kind": "answer" or "distractor" }`. Include both kinds. `line` is the zero-based index into `script`. Use non-overlapping, exact substrings that occur once on their line. |
| `connected-speech` | `word-count` | Text items with numeric answers. Use `rules.numbers: "integer"` to accept spelled-out counts. Explain how words are counted. |
| `connected-speech` | `reduced-cloze` | Text items with a visible blank and `rules.contractions: true` where the long and short forms are equivalent. |
| `connected-speech` | `number-contrast` | Choice items with easily confused number labels such as `14` and `40`. |
| `connected-speech` | `ending-contrast` | Choice items with labels differing by word endings, such as `walk` and `walked`. |
| `prediction` | `predict-verify` | Text items with `expectedType` set to `number`, `date`, `name`, `noun`, `adjective`, `verb`, `time`, or `place`. Optional learner guesses are saved as notes. The score counts type tags and final answers separately. |

## Text grading

- Unicode normalization, case folding, whitespace, and most punctuation differences are automatic. Internal apostrophes and decimal points retain meaning. Grouping commas in numbers are removed. Use explicit variants for dates, prices, and other forms whose meaning depends on context.
- British/US equivalents are in `SPELLINGS` in [listening-methods-core.js](../assets/js/listening-methods-core.js). Set `rules.spelling: false` for literal spelling drills.
- Set `rules.numbers: "integer"` to treat numeric strings and whole English number words from zero to ninety-nine as equivalent. Set `rules.numbers: "digits"` for digit sequences, recognizing `oh`, individual digit words, and `double` before a single digit. Use variants for additional spoken forms.
- Set `rules.contractions: true` for the unambiguous contractions listed in the grading module. Add variants to handle ambiguous expansions in context. Contractions otherwise retain their distinction.
- Each item contributes one point. Dictation uses a word-level comparison for feedback. Choice grades use exact choice IDs.

## Source and audio

An original clip requires `source: { "kind": "original", "attribution": string, "licence": string }`. Describe the script's provenance or licence and credit the voice provider in attribution. Run `npm run audio:methods` after editing scripts. Pass method IDs to build only those methods and add `--force` to regenerate existing output. The builder uses the same voice synthesis and FFmpeg pipeline as the practice tests and skips unchanged clips based on modification time.

A Tatoeba clip requires `source.kind: "tatoeba"`, `sentenceId` and `audioId` as integers, and `speaker`, `attribution` (text contributor), `licence` (audio licence label), `link` (sentence URL), `attributionURL` (speaker credit URL), `audioLicence` and `textLicence` (Creative Commons URLs). Retain the original MP3 and update the README credits. Allowed audio licences are CC BY, CC BY-SA, and CC0. The builder preserves these external recordings.

## JSON Schema (Draft 2020-12)

This describes the shape of each exercises file. The site checker also verifies method-to-format membership, references between fields, matching catalogue IDs and audio files.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "minItems": 1,
  "items": {
    "type": "object",
    "properties": {
      "id": {"type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"},
      "format": {
        "enum": [
          "number-spelling",
          "gap-dictation",
          "sentence-dictation",
          "trap-spotter",
          "paraphrase-match",
          "transcript-highlight",
          "word-count",
          "reduced-cloze",
          "number-contrast",
          "ending-contrast",
          "predict-verify"
        ]
      },
      "title": {"type": "string", "minLength": 1},
      "level": {"type": "string", "minLength": 1},
      "instructions": {"type": "string", "minLength": 1},
      "clips": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/clip"}}
    },
    "required": ["id", "format", "title", "level", "instructions", "clips"],
    "allOf": [
      {
        "if": {
          "properties": {
            "format": {
              "enum": [
                "trap-spotter",
                "paraphrase-match",
                "transcript-highlight",
                "number-contrast",
                "ending-contrast"
              ]
            }
          }
        },
        "then": {
          "properties": {
            "clips": {
              "items": {
                "properties": {
                  "items": {
                    "items": {
                      "required": ["choices"],
                      "properties": {
                        "choices": {"type": "array", "minItems": 2, "items": {"$ref": "#/$defs/choice"}},
                        "variants": false
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        "if": {"properties": {"format": {"enum": ["trap-spotter"]}}},
        "then": {
          "properties": {
            "clips": {
              "items": {
                "properties": {
                  "items": {
                    "minItems": 2,
                    "maxItems": 2,
                    "prefixItems": [
                      {"required": ["role"], "properties": {"role": {"const": "fact"}}},
                      {"required": ["role"], "properties": {"role": {"const": "cue"}}}
                    ]
                  }
                }
              }
            }
          }
        }
      },
      {
        "if": {"properties": {"format": {"enum": ["predict-verify"]}}},
        "then": {
          "properties": {
            "clips": {
              "items": {
                "properties": {
                  "items": {
                    "items": {
                      "type": "object",
                      "properties": {
                        "expectedType": {
                          "enum": ["number", "date", "name", "noun", "adjective", "verb", "time", "place"]
                        }
                      },
                      "required": ["expectedType"]
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        "if": {"properties": {"format": {"enum": ["transcript-highlight"]}}},
        "then": {
          "properties": {
            "clips": {
              "items": {
                "type": "object",
                "properties": {
                  "highlights": {
                    "type": "array",
                    "minItems": 2,
                    "items": {"$ref": "#/$defs/highlight"},
                    "allOf": [
                      {"contains": {"required": ["kind"], "properties": {"kind": {"const": "answer"}}}},
                      {
                        "contains": {"required": ["kind"], "properties": {"kind": {"const": "distractor"}}}
                      }
                    ]
                  }
                },
                "required": ["highlights"]
              }
            }
          }
        }
      }
    ]
  },
  "$defs": {
    "line": {
      "type": "object",
      "properties": {
        "speaker": {"type": "string", "minLength": 1},
        "voice": {"type": "string", "minLength": 1},
        "text": {"type": "string", "minLength": 1}
      },
      "required": ["speaker", "voice", "text"]
    },
    "choice": {
      "type": "object",
      "properties": {
        "id": {"type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"},
        "label": {"type": "string", "minLength": 1}
      },
      "required": ["id", "label"]
    },
    "item": {
      "type": "object",
      "properties": {
        "id": {"type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"},
        "prompt": {"type": "string", "minLength": 1},
        "answer": {"type": "string", "minLength": 1},
        "explanation": {"type": "string", "minLength": 1},
        "variants": {"type": "array", "minItems": 0, "items": {"type": "string", "minLength": 1}},
        "rules": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "numbers": {"enum": ["integer", "digits"]},
            "contractions": {"type": "boolean"},
            "spelling": {"type": "boolean"}
          }
        }
      },
      "required": ["id", "prompt", "answer", "explanation"]
    },
    "source": {
      "type": "object",
      "properties": {
        "kind": {"enum": ["original", "tatoeba"]},
        "attribution": {"type": "string", "minLength": 1},
        "licence": {"type": "string", "minLength": 1}
      },
      "required": ["kind", "attribution", "licence"],
      "if": {"required": ["kind"], "properties": {"kind": {"const": "tatoeba"}}},
      "then": {
        "type": "object",
        "properties": {
          "sentenceId": {"type": "integer", "minimum": 1},
          "audioId": {"type": "integer", "minimum": 1},
          "speaker": {"type": "string", "minLength": 1},
          "link": {"type": "string", "pattern": "^https://tatoeba[.]org/en/sentences/show/[0-9]+$"},
          "attributionURL": {"type": "string", "pattern": "^https://"},
          "audioLicence": {
            "type": "string",
            "pattern": "^https://creativecommons[.]org/(licenses/(by|by-sa)/[1-4][.]0(/[a-z]{2})?|publicdomain/zero/1[.]0)/?$"
          },
          "textLicence": {
            "type": "string",
            "pattern": "^https://creativecommons[.]org/(licenses/(by|by-sa)/[1-4][.]0(/[a-z]{2})?|publicdomain/zero/1[.]0)/?$"
          }
        },
        "required": ["sentenceId", "audioId", "speaker", "link", "attributionURL", "audioLicence", "textLicence"]
      }
    },
    "highlight": {
      "type": "object",
      "properties": {
        "line": {"type": "integer", "minimum": 0},
        "text": {"type": "string", "minLength": 1},
        "kind": {"enum": ["answer", "distractor"]}
      },
      "required": ["line", "text", "kind"]
    },
    "clip": {
      "type": "object",
      "properties": {
        "id": {"type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"},
        "audio": {"type": "string", "pattern": "^assets/audio/listening/methods/[a-z-]+/[a-z0-9-]+[.]mp3$"},
        "script": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/line"}},
        "items": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/item"}},
        "source": {"$ref": "#/$defs/source"}
      },
      "required": ["id", "audio", "script", "items", "source"],
      "if": {"properties": {"source": {"required": ["kind"], "properties": {"kind": {"const": "original"}}}}},
      "then": {
        "properties": {
          "script": {
            "items": {
              "properties": {
                "voice": {
                  "enum": [
                    "en-GB-female-1",
                    "en-GB-male-1",
                    "en-AU-female-1",
                    "en-AU-male-1",
                    "en-US-female-1",
                    "en-US-male-1",
                    "en-GB-narrator"
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
}
```
