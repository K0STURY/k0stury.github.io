---
# Copy this file to start a post. Its name becomes the address: my-project.md -> /blog/my-project
# (files starting with "_", like this one, are left off the site)
title: My Project
description: One or two sentences about it. Shown on its card in the dev log and in link previews.
date: 2026-10-01
# Optional: a cover photo. Put images in a folder next to the post, named after it
cover: ./my-project/cover.png
coverAlt: What the cover shows
# The tech it's built with
tags: [C++, Dear ImGui]
# Optional: where to find it
links:
  - label: GitHub
    url: https://github.com/you/project
  - label: Itch.io
    url: https://k0stur.itch.io/
# true keeps it off the live site; it still shows while running `npm run dev`
draft: true
---

## Introduction

Write in plain Markdown. `##` starts a section (it gets the highlighter stroke), `###` a part within it.

![What the screenshot shows](./my-project/screenshot.png)

```cpp
// Code blocks get their language from the fence: cpp, json, cs, hlsl, py...
int main() { return 0; }
```
