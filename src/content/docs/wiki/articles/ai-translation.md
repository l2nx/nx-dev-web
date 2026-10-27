---
title: AI translation
description: How AI translation of wiki articles works - what gets translated, request statuses, limits, timeouts and edge cases.
---

An author writes an article in one language and gets drafts in the other wiki languages (`ru`, `uk`, `en`, `es`) in
one step. AI never publishes anything: the author proofreads each draft and publishes it as usual.

## How it works

The translation is asynchronous: the request is accepted at once, the translated text lands in the drafts seconds
later.

1. The author starts AI translation on the source article. Target languages are optional; without them, every other
   language whose version is missing or still a draft is translated.
2. Right away, before any translation, each target language gets a draft (`DRAFT`) in the same translation group. A
   missing version is created; an existing draft is overwritten with a copy of the source: content, title,
   description, SEO.
3. All languages are translated in parallel and independently: one failing language does not stop the others.
4. When a translation is ready, it replaces the draft's text. The draft's request status goes from "translating" to
   "done" or "failed" with an error code.
5. Until the author saves the draft themselves, it is marked "AI translation, not proofread". The author publishes
   it as any other draft.

The translation keeps the source's slug when that slug is free in the target language on the same server; otherwise
a slug is generated from the translated title. The author can change it later.

## What gets translated

The structure of the article is kept as is; only the text changes.

| Element                                                                                   | What happens                                                                                                   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Title, description, SEO title, SEO description                                            | translated                                                                                                     |
| Paragraphs and headings, including those inside lists, tables, callouts, spoilers, quotes | translated                                                                                                     |
| Image captions (`alt`, `title`) and spoiler titles                                        | translated                                                                                                     |
| Bold, italics, links and other formatting                                                 | stay on the same words                                                                                         |
| Item, NPC and skill mentions                                                              | not translated: the card shows the name in the reader's language by itself                                     |
| Mention of another article                                                                | points to that article's published version in the target language when there is one; otherwise to the original |
| Code blocks and inline code                                                               | not translated                                                                                                 |
| Images, tables, layout                                                                    | copied as is                                                                                                   |

There is no glossary of game terms: the model translates terms in plain text on its own, and the author proofreads
them.

## Request statuses

Each draft has its own status; the latest request is shown.

| Status                    | Meaning                                                                                    | What to do                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Translating (`PENDING`)   | translation in progress                                                                    | wait; editing the draft now cancels its translation                          |
| Done (`DONE`)             | the translation is in the draft                                                            | proofread and publish                                                        |
| Failed (`FAILED`)         | the translation did not work out; the draft is still a copy of the source                  | start the translation of that language again; the cause is in the error code |
| Cancelled (`CANCELLED`)   | the author saved, changed the status of or deleted the draft while it was being translated | nothing: the manual edit wins, a late translation does not touch the draft   |
| Superseded (`SUPERSEDED`) | the translation was started again while the previous one was running                       | nothing: only the latest request is applied                                  |

## Limits and timeouts

| What                             | Value                                                                                                   | When exceeded                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Translatable text of the article | 120 000 characters                                                                                      | refused at once (`INPUT_TOO_LARGE`), no drafts are created                    |
| Request size                     | 1 MB                                                                                                    | same refusal; happens to articles with a very large number of small fragments |
| Wait for one model reply         | 70 s                                                                                                    | the call is retried once; a second timeout fails the language (`LLM_ERROR`)   |
| Whole translation                | 5 min                                                                                                   | finished languages are kept, unfinished ones fail (`AGENT_TIMEOUT`)           |
| No result at all                 | 15 min                                                                                                  | the request fails (`TIMEOUT`)                                                 |
| Permissions                      | `ARTICLES_CREATE` when a new language version is created, `ARTICLES_UPDATE` when a draft is overwritten | `403`                                                                         |

Only text counts toward the limit: mentions, images and layout do not. A typical guide of about 14 000 characters of
article markup carries roughly 1 000-2 000 characters of text.

A typical article is translated into three languages in 10-15 seconds; a long one (about 25 000 characters of
text) in about a minute and a half.

## Edge cases

| Situation                                                                          | Behaviour                                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A language is chosen explicitly and its version is published or archived           | the whole request is refused (`TRANSLATION_NOT_DRAFT`) with the list of such languages; no language changes         |
| A language is not chosen and its version is published or archived                  | the language is skipped: AI never touches a published version                                                       |
| A language is chosen explicitly and its version is deleted, awaiting final removal | the request is refused (`TRANSLATION_DELETED`)                                                                      |
| Nothing to translate: every other language is published                            | `400`                                                                                                               |
| The article's own language, a repeated language or an unknown language is chosen   | `400`                                                                                                               |
| System article (generated automatically)                                           | refused (`SYSTEM_ARTICLE_READONLY`): such articles are translated by their generators                               |
| The author edits, changes the status of or deletes a draft during its translation  | that language's translation is cancelled and the edit stays; the other languages go on                              |
| The author edits the source during translation                                     | the translation is not cancelled: the text as of the start is translated                                            |
| Translation is started again while the previous one is running                     | the previous one is superseded, only the new one is applied                                                         |
| The draft already exists and has manual edits                                      | it is overwritten with a copy of the source and the edits are lost: do not start a translation on a proofread draft |
| An image is uploaded or removed during translation                                 | the translation does not overwrite it                                                                               |
| The model breaks the markup                                                        | one retry; if that fails too, the language fails (`TAGS_MISMATCH`) and the draft stays a copy of the source         |
| A service restarts between the start and the hand-off                              | the request is delivered after the restart; a repeated result is applied at most once                               |
| The source is deleted for good after translation                                   | the drafts and their history stay; the link to the source is empty                                                  |

## Error codes

On "failed" the draft does not change: it still holds a copy of the source. Starting that language again almost
always helps.

| Code                                                                          | Cause                                                                                           |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `LLM_ERROR`                                                                   | the model did not answer: a provider failure, or no reply within 70 s twice                     |
| `TAGS_MISMATCH`                                                               | the model broke the markup twice, or the translation did not fit the draft                      |
| `AGENT_TIMEOUT`                                                               | the language did not finish within the 5 minutes of the whole translation                       |
| `TIMEOUT`                                                                     | no result for 15 minutes                                                                        |
| `INPUT_TOO_LARGE`                                                             | the article is longer than the limit                                                            |
| `MISSING_TRANSLATION`, `INVALID_RESULT`, `CONTENT_INVALID`, `ASSEMBLY_FAILED` | a result arrived but no draft could be built from it; if a retry does not help, contact support |
| `AGENT_FAILED` and others                                                     | the translation service failed as a whole; if a retry does not help, contact support            |
