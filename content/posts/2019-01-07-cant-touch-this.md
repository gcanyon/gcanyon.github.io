---
title: Can’t Touch This!
date: 2019-01-07
time: 16:42
topic: product
dek: Thoughts on which UI elements should respond to the user’s touch in iOS.
hero: /img/medium/1024-1_-UEeCH7NhLqMt0Xm7i4eAA.png
thumb: /img/medium/1024-1_-UEeCH7NhLqMt0Xm7i4eAA.png
---
The iOS Camera application supports “burst mode”: hold down the shutter button or the volume button and the camera will take multiple photos in rapid succession (about eight per second in my experience). The Photos app doesn’t display these photos separately; instead, it displays them as one “burst”, with the option to choose among them and delete unnecessary photos from the sequence. This is a great feature: if someone blinks, or moves suddenly, that might ruin one photo, but others in the burst will be fine. iOS even does a good job choosing which photo to show to represent the burst when browsing photos.

But the option to select photos from a burst is not user friendly, and illustrates an important aspect of a touch-based interface: what, exactly, should be touchable?

![The Photos app showing a burst of 8 photos](/img/medium/225-1_h9yaHn8QL7KPDhkBlafTcw.png)

To the left is the Photos app showing a photo burst. You can see that it is a photo burst because of the small grey file folder(?) icon in the upper-left, and the grey text that says, “Burst (8 photos)”.

You can also see that it is a photo burst because the command bar at the bottom includes the command, “Select…”. Non-burst photos don’t show that option.

![The “Burst (8 photos)” label and the “Select…” command on opposite edges of the screen](/img/medium/225-1_lPPSIlQ5XBLG9XWrFSO0gg.png)

To the left: how are these two items connected? They are not styled the same, they are not proximate to each other. How is the user to infer that “Select…” means “select from among the photos in this burst”? When looking at all photos rather than a single (possibly burst) photo, “Select” (no ellipsis) appears in a different location and means select different photos to do something with them. The interface for selecting photos in a burst is very different from selecting photos in a gallery, but I’ll cover that in a separate post. For now, the issue is that the word “select” is vague and means nothing without the context provided by the text “Burst (8 photos)”, which appears on the opposite edge of the screen (closer in landscape mode, as shown above, but still not close). I’m sympathetic to the UX designer, because it’s hard to think of a better word to use here, but the fact that it’s hard just means that perhaps the whole experience needs to be reworked.

But here’s the question I want to explore: **should the icon and phrase “Burst (8 photos)” be touchable?**

The meta-question of course is: what in this display is touchable, and how is that indicated? The original iOS interface was highly skeuomorphic, meaning that interface elements were designed to resemble real-world controls, to help users new to a touch interface understand what they could and couldn’t change by touching it. That was largely abandoned in iOS 7, hopefully not merely as a stylistic choice, but because it was thought that the same “touch here” information could be conveyed as effectively by other means.

Having spent a minute considering this screen shot, that assumption seems questionable; I’ve used iOS since it launched, and at the risk of sounding unobservant, I *just now* realized that all the touchable elements (in Photos, at least) are distinguished by a unique shade of blue. So blue elements are touchable, grey elements are not. It’s okay for users to know something like this subconsciously, but I, at least, had not internalized this blue rule the first time I took a burst image and tapped a half dozen times or more on “Burst (8 photos)” trying to figure out how to select burst images.

***Interlude: a History Lesson***

![Balloon Help for the Finder’s Special menu](/img/medium/247-1_rGYqyqqDoVQnUI29ZWTdcg.png "Balloon Help for the Finder’s Special menu")

In the 1990s the Macintosh operating system had a thing called “Balloon Help”. Turned on and off by menu, Balloon Help displayed text (and optionally, graphics) to answer the user’s questions: “What is this?” and “How do I use this?” For example, the Balloon Help for the Copy menu item was “Copies the selected text onto the clipboard” if text was selected. Importantly, if there was no text selection the Balloon Help read, “Not available now because there is no selection”.

Back to the main question: **should “Burst (8 photos)” be touchable?**

Currently: the text “Burst (8 photos)” does nothing; the text “Select…” does something, but describes what it does poorly. So without changing the current interface, Balloon Help provides a simple solution: if the user taps on “Burst (8 photos)”, display a message that says,

> This burst contains 8 photos taken in rapid succession. Tap “Select…” below to choose which photos to keep and which to discard.

One positive aspect of this solution is that it is invisible to the user unless it’s needed. One drawback of Balloon Help was how intrusive it was. Most people left it off by default and forgot about it. This message could display to the user only and exactly if it were needed: if the user taps on an undesired element. It then provides guidance to the user, pointing them in the right direction so they never see the message again.

If the user interface is up for modification, consider changing the functional text to: “8 Photos: Select…”. Or more compactly, the small folder icon (suitably resized) with an “8” superimposed on it, followed by “Select…” There are numerous options, and user testing would reveal the best solution. The whole interface for selecting photos from bursts needs work; I’ll cover that in a separate article.

**Conclusion: Things that a user might reasonably touch should respond to that touch, even if only to point the user toward the expected action.**

*Postscript*: Microsoft gained the rights to the Balloon Help patent in the 90s and implemented it in Windows. Here are images of Balloon Help on a color Mac running System 8, and on Windows 8.1. This says a lot about the UI design sensibilities of Apple vs. Microsoft.

![Balloon Help on a Mac running System 8](/img/medium/260-1_JE2F-0v53cqalg9ewdzo7A.png "Balloon Help on a Mac running System 8")

![Balloon Help on Windows 8.1](/img/medium/182-1_5f2SFmOyrAYUlSexqHEhkg.png "Balloon Help on Windows 8.1")
