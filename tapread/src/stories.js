// ---------------------------------------------------------------------------
// Built-in stories. Script format (same as plain-text import):
//   ===          page break
//   ## Heading   chapter heading
//   @pic 🐱🎩    a picture line (emoji)
//   blank line   new paragraph
// ---------------------------------------------------------------------------
const BUILTIN_STORIES = [
{ id:'b-cat-hat', title:'Cat and Hat', author:'Tap & Read', level:1, cover:'🐱', text:`
@pic 🐱
This is Cat.
===
@pic 🎩
This is a hat.
===
@pic 🐱🎩
Cat sees the hat.
===
@pic 🐱❓
Is the hat for Cat?
===
@pic 🎩🐱
Cat gets in the hat.
===
@pic 🎩
Where is Cat?
===
@pic 👀🎩
I can see a tail!
===
@pic 🐱✨
Here is Cat!
===
@pic 😺🎩
Cat likes the hat.
===
@pic 💤🎩
Now Cat naps in the hat.
`},
{ id:'b-up', title:'Up, Up, Up!', author:'Tap & Read', level:1, cover:'🎈', text:`
@pic 👧🎈
Mia has a red balloon.
===
@pic 🌬️🎈
The wind is big.
===
@pic 🎈⬆️
Up goes the balloon.
===
@pic 🌳🎈
Up past the tree.
===
@pic 🏠🎈
Up past the house.
===
@pic 🐦🎈
A bird says, "Hello!"
===
@pic ☁️🎈
Up to the clouds.
===
@pic 👧😢
"Come back!" says Mia.
===
@pic 🎈⬇️
Down, down, down it comes.
===
@pic 👧🎈😀
Mia hugs her red balloon. The end!
`},
{ id:'b-fox-crow', title:'The Fox and the Crow', author:'A fable, retold', level:2, cover:'🦊', text:`
@pic 🐦🧀
A crow found a big piece of cheese. She flew up to a high branch to eat it.
===
@pic 🦊
A hungry fox walked by. He looked up and saw the cheese. "I want that cheese," he said to himself.
===
@pic 🦊🌳
"Good morning, Crow!" said the fox. "What shiny feathers you have! What bright eyes!"
===
@pic 🐦
The crow sat up tall. She liked to hear such nice words.
===
@pic 🦊🎶
"I am sure your song is the best in the whole wood," said the fox. "Will you sing for me, just once?"
===
@pic 🐦🎵🧀
The crow was so proud that she opened her beak to sing. "Caw! Caw!"
===
@pic 🧀⬇️🦊
Down fell the cheese, right into the mouth of the fox.
===
@pic 🦊😋
"Thank you," said the fox. "Here is a tip for you: do not trust someone just because they say nice things."
===
@pic 🐦💭
The crow never forgot it.
`},
{ id:'b-tortoise-hare', title:'The Tortoise and the Hare', author:'A fable, retold', level:2, cover:'🐢', text:`
@pic 🐇💨
Hare was very fast, and he liked to tell everyone about it. "No one can beat me," he said.
===
@pic 🐢
Tortoise was very slow. One day she said, "I will race you, Hare."
===
@pic 🐇😂
Hare laughed and laughed. "You? Race me? Okay, let's go!"
===
@pic 🏁🐇🐢
All the animals came to watch. Owl said, "Ready, set, go!"
===
@pic 🐇💨💨
Hare ran so fast that soon Tortoise was far behind. He could not even see her.
===
@pic 🐇🌳😴
"I have lots of time," said Hare. He sat down under a tree for a little rest. Soon he was fast asleep.
===
@pic 🐢👣
Tortoise kept going. Step, step, step. She did not stop, not even once.
===
@pic 🐢🌳🐇💤
She walked right past the sleeping Hare.
===
@pic 🐇😮
When Hare woke up, the sun was low. He ran as fast as he could!
===
@pic 🐢🏁🎉
But Tortoise was already at the finish line. All the animals cheered.
===
@pic 🐢😊
"Slow and steady wins the race," said Tortoise with a smile.
`},
{ id:'b-pip-light', title:'Pip and the Lighthouse', author:'Tap & Read', level:3, cover:'⛵', text:`
## Chapter One: The Little Keeper

@pic 🏠💡🌊

Pip lived with her grandfather in a white lighthouse at the edge of the sea. Every night, Grandpa climbed the one hundred steps to the top and lit the great lamp.

The light swept across the dark water, round and round, so that the fishing boats could find their way home.

"Why does it have to turn?" Pip asked one evening.

"So that every boat can see it, wherever it is," said Grandpa. "A light that only shines one way is only half a light."
===
Pip liked to count the steps as they climbed. Some nights she counted by ones. Some nights she counted by twos. On very windy nights she did not count at all, because she was too busy holding the rail.

From the top, she could see the whole harbor. She knew every boat by its color. The blue one was Mr. Ortega's. The yellow one belonged to the twins. The little green one with the patched sail was old Mrs. Finch's, and it was always the last one home.
===
## Chapter Two: The Storm

@pic ⛈️🌊

One afternoon the sky turned the color of a bruise. The wind began to howl, and the waves grew taller than houses.

"A storm is coming," said Grandpa. He rubbed his knee, which always ached before bad weather. "I will go up early tonight."

But when he stood up, his knee would not bend. He sat back down with a groan.

"I can't climb the steps, Pip," he said quietly. "Not tonight."
===
Pip looked out of the window. She could see the blue boat and the yellow boat coming in fast. But where was the little green boat?

"Mrs. Finch is still out there," Pip whispered.

Grandpa looked at her for a long moment. Then he took the big brass key from his pocket and put it in her hand.

"You know the way," he said. "One hundred steps. Turn the key, open the valve, and strike the match. Just like we practiced."
===
## Chapter Three: One Hundred Steps

@pic 🔦🪜

Pip ran to the stairs. The tower shook with every gust of wind. Rain hammered on the walls.

She counted out loud to keep herself brave. "Twenty. Twenty-one. Twenty-two." Her legs burned. "Sixty. Sixty-one." Her hands were cold. "Ninety-nine. One hundred!"

At the top, she turned the key. She opened the valve. Her fingers shook as she struck the match. Once. Twice. On the third try, the flame caught.

The great lamp blazed, and the light began to turn.
===
@pic 💡✨⛵

Far out on the black water, a tiny green sail turned toward the light.

Pip watched until the little boat slipped safely into the harbor. Then she sat down on the floor, very tired and very happy.

The next morning, Mrs. Finch came up the path with a basket of warm bread.

"Thank you for the light," she said.

"It wasn't only me," said Pip. "Grandpa taught me how."

Grandpa smiled from his chair by the window. "A light that is shared," he said, "is a whole light."
`}
];

// Words used for distractors and as a fallback when a reader has no practice words yet.
const SIGHT_WORDS = `a and away big blue can come down find for funny go help here I in is it jump little look make me my not one play red run said see the three to two up we where yellow you all am are at ate be black brown but came did do eat four get good have he into like must new no now on our out please pretty ran ride saw say she so soon that there they this too under want was well went what white who will with yes after again any as ask by could every fly from give going had has her him his how just know let live may of old once open over put round some stop take thank them then think walk were when always around because been before best both buy call cold does fast first five found gave goes green its made many off or pull read right sing sit sleep tell their these those upon us use very wash which why wish work would write your`.split(/\s+/);
