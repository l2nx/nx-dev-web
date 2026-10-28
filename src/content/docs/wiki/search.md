---
title: Search
description: What the wiki search looks in for items, skills, NPCs, classes, articles and the event schedule, and how popularity orders results.
---

The wiki search window and the wiki lists follow the shared L2NX search rules: query length, syntax, ids, typos,
wrong keyboard layout and the order of results are described in [Search](/guide/search/). This page lists only what
the wiki searches in each kind of entry.

## What is searched

| Entry       | Id                       | Names and text                                                                        |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Items       | item id                  | name in every language, including a name the server team changed and the original one |
| Skills      | skill id                 | name in every language, including a changed name; all levels of a skill are one entry |
| NPCs        | NPC id                   | name and title, including the server's own name and title for the NPC                 |
| Classes     | none: `#N` finds nothing | name in every language and the class token (`GLADIATOR`)                              |
| Articles    | article id (UUID)        | title, summary, category and its parent category; not the article text                |
| Raid bosses | NPC id                   | name                                                                                  |
| Sieges      | castle id                | castle name and the name of the clan that owns the castle                             |
| Events      | none                     | name and event code                                                                   |

- Raid bosses, sieges and events are searched in the event schedule: each category keeps its matching entries.
- An article matches by its title first, then by its summary, then by its category: on the same match strength a
  title match goes first.
- Entries the server team hid from the wiki do not appear in search.

## Popularity

Among entries with the same match strength, the more viewed one goes first. Popularity is the number of page views
over the last 30 days:

- items, skills, NPCs and classes count views on the server you are browsing;
- articles count views of the article itself.

The event schedule has no popularity: its entries follow the match strength only.
