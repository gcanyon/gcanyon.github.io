---
title: Lightyard
date: 2026-10-19
topic: games
pinned: true
dek: Lightyard is a challenging puzzle game I created where you set up mirrors to get packets of light from the emitters to the receivers.
thumb: /img/lightyard-thumb.jpg
---
:::play Lightyard | Pick a puzzle, place mirrors, press play. The ? button has the full rules. Opens in a new tab. | /lightyard.html

In Lightyard you position mirrors and other controls to guide packets of light from the emitters to the receivers. It's inspired by [Trainyard](https://trainyard.ca), a favorite of mine whose app is no longer in the App Store. I created Lightyard using Claude and ChatGPT.

You place mirrors, half-mirrors, and prisms to guide packets of colored light from emitters to receivers. Each emitter gives a determined sequence of colors, and each receiver wants a specific sequence of colors. Those sequences can be in a different order, or different colors completely, and you have to find ways to get the receivers what they want.

:::video /img/lightyard.mp4 | /img/lightyard-board.png | A puzzle being solved: packets of light run from the emitters to the receivers.

## Mixing light

When packets cross, they take on the union of their colors: red and blue make magenta, red and green make yellow, etc. Packets can also merge, becoming one packet with their color union. A prism can split packets apart, duplicating the primary colors, and splitting e.g. magenta into blue and red. Crystals slow and filter light, transformers step a color along the spectrum — there are many variations.

## Build your own

Lightyard comes with many puzzles built in, and you can create your own and share them. Lightyard is a single page self-contained web app, and everything you create is saved in your browser.

## Building Lightyard

I initiated Lightyard in Claude, one-shotting the initial gameplay with emitters, receivers, mirrors and prisms; design mode and play mode. Here's [the prompt I used](/prompts/lightyard-first-prompt.txt).

That prompt worked, and produced a working app, but if you try Lightyard now, you will immediately see that a lot has changed since that first implementation. As I've built and solved puzzles and tried things out, I've iterated well over 100 times. I started with Claude, but I've taken the app to ChatGPT and gone back and forth at various times.

I’m actively developing Lightyard, so check back for improvements and more puzzles over time.

:::play Lightyard | Pick a puzzle, place mirrors, press play. The ? button has the full rules. Opens in a new tab. | /lightyard.html
