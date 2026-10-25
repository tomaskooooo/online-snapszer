# Snapszer – rules for the web game

Source of truth for the rules engine. Everything marked **[ASSUMED]** is my guess and needs your OK.
Hungarian terms are in brackets.

## 1. Modes

| Mode | Players | Deck | Talon | Hands |
|---|---|---|---|---|
| 1v1 | 2 | 20 cards (no 9) | yes, 10 cards | 5 cards each, draw after each trick |
| 2v1 | 3 | 24 cards (with 9) | none | 8 cards each (4 + 4) |
| 2v2 | 4 | 24 cards (with 9) | none | 6 cards each (3 + 3) |

The host picks the mode and the starting score when creating the lobby.

## 2. Cards

- Suits: Tök (bells), Zöld (leaves), Piros (hearts), Makk (acorns).
- Ranks, high to low: Ász (11), Tízes (10), Király (4), Felső (3), Alsó (2), 9 (0).
- 120 card points in the 24-card deck, 120 in the 20-card deck.
- **Adu** (trump): the suit chosen by the caller. Any adu beats any card of another suit.

## 3. Scoring across a match

- Every player has an own score and counts **down** from the start score the host picks: **30, 40, 50 or 60**.
- The first player to reach **0 or below** wins the match.
- Scoring is **per player**. When a side wins a hand, each member of that side goes down by the amount.

## 4. Hand result

A hand is won by the side that reaches **66 card points** first, or, if nobody does, by the side that wins the **last trick**.

The loser side's card points are pooled (2v1: both opponents together; 2v2: both partners together).

| Loser side's situation | Winner goes down by |
|---|---|
| Loser side collected **33+** points | **2** |
| Under 33 points but has won at least one trick | **4** |
| Has won no trick at all | **6** |
| Snapszer declared and won | **12** |
| Went all the way (every trick won), durkó not declared | **22** |
| Went all the way (every trick won), durkó declared beforehand | **32** |

This table applies to every mode, including 1v1.

If the caller's side fails (fails to win), the other side scores the same table, based on the caller side's card points. **[ASSUMED]** A failed Snapszer gives the opponents 12; a failed durkó gives the opponents 32.

## 5. Playing tricks (2v1 and 2v2: from the first trick; 1v1: once the talon is gone or covered)

The winner of a trick leads the next one. A trick is won by the highest adu in it, or if there is none, by the highest card of the led suit.

When you are not leading, you must:

1. **Have a card of the led suit:** play one. If one of them beats the card currently winning the trick, you must play a card that beats it. Otherwise any card of that suit.
2. **No card of the led suit:** play an **adu**. If an adu is already winning the trick, you must beat it with a higher adu when you can; otherwise any adu. **[ASSUMED]** if you cannot beat it you still must play an adu.
3. **No led suit and no adu:** any card.

If an adu is led, follow the same rule with adu as the led suit.

In 1v1 while the talon still has cards, you may play any card (no obligation to follow or beat).

An illegal card is not allowed by the game. The engine only offers legal cards.

## 6. Mode details

### 6.1 1v1
- Deal 3 cards each, turn up the next card as the adu card, deal 2 more each. Place the remaining cards (talon) face down on it, with the adu card visible.
- The non-dealer leads; the winner of each trick draws first.
- **Alsó swap:** on your lead you may swap your adu Alsó for the face-up adu card, while the talon holds at least 3 cards.
- **Pairs (20/40):** on your lead, Király + Felső of the same suit: 20 points (40 in adu). Points count only after you have won a trick. This exists **only in 1v1**.
- **Cover (betakar):** on your lead you may turn the adu card face down. No more drawing; strict play (section 5) starts. The coverer must reach 66 with the cards in hand. **[ASSUMED]** If the coverer fails, the opponent wins the hand and scores by section 4 using the coverer's card points.
- Last trick winner wins the hand if nobody reaches 66.

### 6.2 2v1 (three players)
- Deal 4 cards to each player. The player who receives cards first (the caller) names the adu suit from those 4 cards. Then deal 4 more to each.
- The caller plays alone against the two others and leads the first trick.
- The caller rotates clockwise each hand. **[ASSUMED]**
- No folding, no pairs, no talon.

### 6.3 2v2 (four players)
- Deal 3 cards to each player. The caller (first to receive cards) names a specific card, for example "Tök Ász". The **suit of that card becomes the adu**. Then deal 3 more to each.
- Whoever holds the called card is the caller's partner. **Partners are secret** and are only revealed by play and at the end of the hand.
- The caller may call a card he holds himself; then the caller plays alone against the other three (1v3).
- **[ASSUMED]** The caller names the card after seeing only his first 3 cards, before the second round is dealt.
- The caller leads; the caller rotates clockwise each hand.
- No pairs, no talon.

## 7. Declarations (Snapszer and durkó)

- Before the first card is played the caller may declare **Snapszer** (the side must reach 66 before the opponents win any trick) or **durkó** (the side must win every trick).
- In 1v1 either player may declare Snapszer. In 2v1 only the caller. **[ASSUMED]** In 2v2 only the caller.
- Snapszer cannot be combined with durkó. **[ASSUMED]**

## 8. Reaching 66

Nothing ends automatically. A player must press **"Kész!"** himself, as in real life.

- "Kész!" may be pressed only **right after winning a trick** (before leading), or, in 1v1, **right after declaring a pair**. It counts the pooled card points of the claimer's side (including pair points already credited).
- **Correct claim (66+):** the claimer's side wins the hand and scores by the table in section 4 (12 if that side had declared Snapszer).
- **False claim (under 66):** the claimer's side loses; the other side scores by the table, using the claimer side's points and tricks. **[ASSUMED]** If the claimer's side had declared Snapszer, the opponents get 12.
- A side can reach 66 and not press "Kész!". The hand then goes on. If a side wins **every** trick of the hand without pressing "Kész!", it scores 22 (32 if durkó was declared).
- While durkó is declared, "Kész!" is not available. The side must win every trick.
- If the hand is played out and nobody pressed "Kész!" successfully, the winner of the last trick wins the hand (not after a cover, see 6.1).
- A declared Snapszer or durkó fails **immediately** the moment the other side wins a trick (before a successful "Kész!").

## 9. Lobby settings (chosen by the host)

- **Mode:** 1v1, 2v1 or 2v2.
- **Starting score:** 30, 40, 50 or 60.
- **Show point counts:** on or off. When on, every player sees each seat's current card points (and who has won how many tricks). When off, the game shows only the cards in your own tricks pile and the trick counts, so players have to count the points themselves before pressing "Kész!".
