# Snapszer – rules for the web game

Source of truth for the rules engine. Everything marked **[ASSUMED]** is my guess and needs your OK.
Hungarian terms are in brackets.

## 1. Modes

| Mode | Players | Deck | Talon | Hands |
|---|---|---|---|---|
| 1v1 | 2 | 20 cards (no 9) | none | 8 cards each (4 + 4), 4 cards stay unused |
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

## 5. Playing tricks (every mode, from the first trick)

The winner of a trick leads the next one. A trick is won by the highest adu in it, or if there is none, by the highest card of the led suit.

When you are not leading, you must:

1. **Have a card of the led suit:** play one. If one of them beats the card currently winning the trick, you must play a card that beats it. Otherwise any card of that suit.
2. **No card of the led suit:** play an **adu**. If an adu is already winning the trick, you must beat it with a higher adu when you can; otherwise any adu. **[ASSUMED]** if you cannot beat it you still must play an adu.
3. **No led suit and no adu:** any card.

If an adu is led, follow the same rule with adu as the led suit.


An illegal card is not allowed by the game. The engine only offers legal cards.

## 6. Mode details

### 6.1 1v1
- Deal 4 cards to each player. The non-dealer is the caller: he names the adutt suit from those 4 cards. Then deal 4 more to each, so everybody plays with 8 cards. The remaining 4 cards stay face down and are never used.
- It works exactly like 2v1 with one opponent: the caller leads, can declare Snapszer or Durch, can forfeit before the first card, and the other player may answer **Kontra** or **Játék**. There is no talon, no trump swap and no covering.
- **Pairs (20/40):** on your lead, Király + Felső of the same suit: 20 points (40 in adutt). Points count only after you have won a trick. Pairs work in **every mode**.
- Last trick winner wins the hand if nobody says Elég!.

### 6.2 2v1 (three players)
- Deal 4 cards to each player. The player who receives cards first (the caller) names the adu suit from those 4 cards. Then deal 4 more to each.
- The caller plays alone against the two others and leads the first trick.
- The caller rotates clockwise each hand. **[ASSUMED]**
- No talon. Pairs (20/40) work in every mode. After the caller declares, the two opponents answer in turn: **Kontra** or **Játék** (play), see section 7.

### 6.3 2v2 (four players)
- Deal 3 cards to each player. The caller (first to receive cards) names a specific card, for example "Tök Ász". The **suit of that card becomes the adu**. Then deal 3 more to each.
- Whoever holds the called card is the caller's partner. **Partners are secret** and are only revealed by play and at the end of the hand.
- The caller may call a card he holds himself; then the caller plays alone against the other three (1v3).
- **[ASSUMED]** The caller names the card after seeing only his first 3 cards, before the second round is dealt.
- The caller leads; the caller rotates clockwise each hand.
- No talon. Pairs (20/40) work in every mode. After the caller declares, the three others answer in turn: **Kontra** or **Játék** (play), see section 7.

## 7. Declarations, forfeit and kontra (the game calls durkó "Durch")

- Before the first card is played the caller may declare **Snapszer** (the side must reach 66 before the opponents win any trick) or **durkó** (the side must win every trick).
- Only the caller may declare Snapszer or Durch (in every mode).
- Snapszer cannot be combined with durkó (Durch). **[ASSUMED]**
- **Forfeit (Feladom):** in every mode the caller may give up the hand at any time before the first card is played (while choosing the adutt, naming the card, or declaring). Every other player goes down **6**, partner or not.
- **Kontra:** in every mode, once the caller has declared, the other players answer one after another with **Kontra** or **Játék**. The first Kontra ends the question and **doubles** whatever the hand scores (2 becomes 4, Snapszer 12 becomes 24, and so on). A kontra does not apply to a forfeit. **[ASSUMED]**

## 8. Reaching 66

Nothing ends automatically. A player must press **"Elég!"** himself, as in real life.

- "Elég!" may be pressed only **right after winning a trick** (before leading), or **right after declaring a pair** (that is the "Elég!" option of the pair dialog). It counts the pooled card points of the claimer's side (including pair points already credited).
- **Correct claim (66+):** the claimer's side wins the hand and scores by the table in section 4 (12 if that side had declared Snapszer).
- **False claim (under 66):** the claimer's side loses; the other side scores by the table, using the claimer side's points and tricks. **[ASSUMED]** If the claimer's side had declared Snapszer, the opponents get 12.
- A side can reach 66 and not press "Elég!". The hand then goes on. If a side wins **every** trick of the hand without pressing "Elég!", it scores 22 (32 if durkó was declared).
- While durkó is declared, "Elég!" is not available. The side must win every trick.
- If the hand is played out and nobody pressed "Elég!" successfully, the winner of the last trick wins the hand.
- A declared Snapszer or durkó fails **immediately** the moment the other side wins a trick (before a successful "Elég!").

## 8b. Going out (when a player reaches zero)

- A player whose score reaches **0 or below** has **gone out** and is safe. The match does **not** end then.
- The players still in the game carry on and play out the remaining points with one player fewer, using the smaller mode: 4 players play 2v2, 3 players play 2v1, 2 players play 1v1. Scores stay as they are.
- The deal moves on to the next player still at the table. A player who is out can keep watching, and any player can press "Következő leosztás".
- Several players can go out in the same hand (for example both partners); the lower score goes out first.
- The match is over when only one player is left. Ranking: first out is first, and the player who stayed to the end is last.
- A rematch starts everybody again from the start score.

## 8c. Elég! with a pair

- Right when declaring a 20/40 a player may add **Elég!**: the pair is declared and 66 is claimed in one step. Only the points already credited count (a pair counts only after its owner has won a trick), so a wrong Elég! loses the hand like any wrong claim.
- It is not available while durch is declared.

## 9. Lobby settings (chosen by the host)

- **Mode:** 1v1, 2v1 or 2v2.
- **Starting score:** 30, 40, 50 or 60.
- **Show point counts:** on or off. When on, every player sees each seat's current card points (and who has won how many tricks). When off, the game shows only the cards in your own tricks pile and the trick counts, so players have to count the points themselves before pressing "Elég!".
