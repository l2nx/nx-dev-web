---
title: Licensing
description: Which license each part of nx-l2 is under, where the code comes from, and what that means for a build you distribute.
---

Licenses are assigned per file, following the [REUSE](https://reuse.software) specification. Every file states its
license and copyright holder, in its header or in `REUSE.toml`, and CI checks it.

| Files                                                        | License    |
| ------------------------------------------------------------ | ---------- |
| new and rewritten files                                      | Apache 2.0 |
| L2J Mobius files with the MIT header                         | MIT        |
| L2J Mobius files with the GPLv3 header                       | GPLv3      |
| L2J Mobius files without a header (data, SQL, configuration) | MIT        |

## What it means for a build

While any GPLv3 file remains in a build, the build as a whole is distributed under GPLv3: anyone may distribute and
modify it, with the source. Running a server without handing the build to anyone is not distribution.

GPLv3 is pushed out, not kept:

- `libs/` and `engine/` hold no GPLv3 file, so they can be used by any emulator, closed ones included.
- A chronicle module becomes permissive when its last GPLv3 file is rewritten. CI prints the GPLv3 file count per
  module.
- A GPLv3 file is rewritten from the behaviour, not by editing its text.

## Where the code comes from

nx-l2 is based on L2J Mobius. The High Five chronicle was imported with its history from upstream commit
`5ddd6ff4b98`. Files taken from Mobius keep their upstream copyright notices and licenses; a file changed in nx-l2
adds the line `2026 L2NX contributors` and keeps its license.

Game mechanics may be checked against other servers for behaviour only. No code, data or structure is copied from
them, and no decompiled, leaked or proprietary code is accepted.

## Contributions

A contribution comes under the license of the file it touches. A new file is Apache 2.0.
