---
title: Search
description: How search works in L2NX interfaces - query length, syntax, ids, typos, wrong keyboard layout and the order of results.
---

Every search field in L2NX interfaces follows the same rules: the wiki search window and its lists, the lists and
dropdowns of the admin panel. A product page lists what that product searches in each kind of entry; this page
describes how a query is read and how results are ordered.

## The basics

- Case does not matter, `ё` and `е` are the same letter, extra spaces are ignored.
- Where an entry has names in several languages, all of them are searched at once: a Russian, English or Ukrainian
  name finds the same entry whatever the interface language is.
- Each word of the query may be the beginning of a word: `sam long` finds "Samurai Longsword".
- When you sort a list by a column yourself, that order wins over the relevance order described below.

## Query length

| Query                    | Works from   |
| ------------------------ | ------------ |
| Text: beginning of words | 2 characters |
| Number (an id)           | 1 digit      |
| Substring, typos         | 3 characters |

A 2-character query finds entries with a word starting with it; from 3 characters the text also matches with typos,
and inside words once one of its words has 3 characters (`ab cd` still looks only at word beginnings). A shorter text query is refused with a hint that it is too short; a single digit is accepted,
but it finds something only where entries are searched by id; elsewhere (and for `#57`) the result is empty. The minimum applies to the whole query, not to each word: in `sword o` the
one-letter `o` still counts as the beginning of a word.

## Syntax

| You type         | What it means                                                                |
| ---------------- | ---------------------------------------------------------------------------- |
| `word1 word2`    | every word must match, in any order                                          |
| `"exact phrase"` | the words must stand together, as typed                                      |
| `-word`          | entries containing this text anywhere, even inside a word, are left out      |
| `-"some phrase"` | entries containing this phrase are left out                                  |
| `57`             | the entry with id 57 **and** entries with a word starting with "57"          |
| `#57`            | only the entry with id 57                                                    |
| a long id (UUID) | for entries identified by a UUID: that entry and text matches, like a number |
| anything else    | is searched literally                                                        |

Examples:

- `breastplate wolf` finds "Blue Wolf Breastplate": word order does not matter.
- `"blue wolf"` finds only names where "blue wolf" stands together.
- `sword -dual` finds swords except dual ones; the excluded text is looked for inside words too, so `-hand` also
  leaves out "Two-Handed Sword". A `-` inside a word (`anti-mage`) is an ordinary character; a `-` standing alone
  (or only dashes) is ignored.
- `57` finds the entry with id 57 first, then entries with a word starting with "57". A longer number such as `570`
  also finds names that contain it inside a word. Use `#57` when many names contain numbers and you only want the id.
- Special characters are searched as typed: `50%` finds names with "50%", `(sword)` finds "(sword)" with the
  brackets. An unclosed quote, `%`, `_`, `*`, brackets and `OR` are ordinary characters. Such text is looked for
  inside names, so it needs 3 characters: `+50` works, `+5` alone may find nothing.

A query of exclusions only (`-sword`) has nothing to search for and is refused like a too short one.

## Typos

From 3 characters search forgives small typos: `olimpiad` finds "Olympiad". A typo match always ranks below an exact
spelling, so typing more letters correctly narrows the results.

## Wrong keyboard layout

A query typed in the wrong layout still finds its entry: `vtx` (the keys of "меч" on an English layout) finds "Меч",
and `ыцщкв` (the keys of "sword" on a Russian layout) finds "Sword". Russian ↔ English and Ukrainian ↔ English
layouts are recognised when the whole query is typed in one layout. Such matches rank below every direct match.

## Order of results

Results go from the strongest match to the weakest:

1. The id matches.
2. The name equals the query.
3. The name starts with the query.
4. Each query word is the beginning of some word in the text (a word with special characters must appear as typed).
5. The text contains each query word.
6. The text matches with a typo.
7. The query matches in the other keyboard layout.

Among entries of the same strength:

- where a product searches several fields, a match in the main one (for example the title) goes first;
- popular entries go first where the product counts popularity; the product page says how;
- a shorter name goes first: "Sword" before "Samurai Longsword";
- otherwise the order follows the id, so pages do not shuffle.

A popular entry never jumps over a stronger match: an exact name stays above a substring in the most visited page.

## What search does not do

- No `OR`, brackets or wildcards (`*`, `%`): they are searched as ordinary characters.
- No search by field (`name:sword`): each product decides which fields are searched.
- No synonyms or word forms: type the beginning of the word instead (`olymp` finds "Olympiad" and "Olympiads").
