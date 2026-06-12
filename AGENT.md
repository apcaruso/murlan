# Roadmap Murlan Multiplayer su Cloudflare Workers + Durable Objects

## Obiettivo

Sviluppare un gioco web multiplayer di Murlan a stanze.

Ogni utente deve poter:

* creare una stanza
* ricevere un link invito
* condividere il link con altri giocatori
* giocare in tempo reale
* partecipare con massimo 5 player per stanza
* rientrare nella stanza dallo stesso browser

La regola architetturale principale e questa:

```txt
Il client non decide mai se una mossa e valida.
```

Il client invia intenzioni. Il Durable Object della stanza valida, modifica lo stato autorevole e invia aggiornamenti realtime.

---

## Stack

```txt
Runtime backend:
  Cloudflare Workers
  Cloudflare Durable Objects

Realtime:
  WebSocket gestiti dal Durable Object della stanza

Stato autorevole:
  Durable Object storage

Frontend previsto:
  SvelteKit o frontend statico servito accanto al Worker

Linguaggio:
  TypeScript
```

---

## Architettura

### Un actor per stanza

Ogni stanza e identificata da un codice pubblico, per esempio `ABCD1234`.

Il Worker usa:

```ts
env.ROOMS.idFromName(roomCode)
```

per ottenere sempre lo stesso Durable Object per quella stanza.

Il Durable Object contiene:

* player della stanza
* sessioni anonime locali
* stato partita autorevole
* mani private
* eventi recenti
* WebSocket connessi

### Flusso alto livello

```txt
client -> Worker API -> Durable Object stanza -> stato validato -> broadcast WebSocket
```

Il Worker esterno fa solo routing. La logica di stanza vive nel Durable Object.

---

## Struttura progetto

```txt
src/lib/game/
  cards.ts
  deck.ts
  rules.ts
  scoring.ts
  state.ts
  actions.ts

src/worker/
  index.ts
  room.ts
  http.ts
  card-ids.ts
  random.ts
  types.ts

src/lib/cloudflare/
  session.ts
  rooms.ts
  realtime.ts

src/lib/components/
  Lobby.svelte
  InviteLink.svelte
  PlayerList.svelte
  Card.svelte
  Hand.svelte
  Table.svelte
  PlayerPanel.svelte
  Scoreboard.svelte
  ActionBar.svelte
  ConnectionStatus.svelte
  GameLog.svelte

src/routes/
  +page.svelte
  room/[roomId]/+page.svelte

wrangler.jsonc
tsconfig.json
```

---

## Stato attuale

Implementato:

* motore carte
* mazzo e distribuzione
* riconoscimento combinazioni
* confronto giocate
* punteggi
* stato partita puro
* azioni pure di gioco
* Worker HTTP router
* Durable Object per stanza
* creazione stanza
* join tramite invite token
* ready state
* start game host-only
* play cards server-side
* pass turn server-side
* leave room
* snapshot stanza
* WebSocket server push
* client API wrappers
* sessione anonima locale per stanza

Ancora da completare:

* UI reale
* collegamento route home/stanza ai wrapper Cloudflare
* gestione errori UX
* reconnect UX completo
* test automatici del Worker
* test multiplayer manuali
* deploy Cloudflare

---

## API Worker

Base path:

```txt
/api
```

### Health

```txt
GET /api/health
```

Risposta:

```json
{ "ok": true }
```

### Create room

```txt
POST /api/rooms
```

Input:

```json
{
  "name": "Alessandro",
  "maxPlayers": 5
}
```

Output:

```json
{
  "roomId": "ABCD1234",
  "code": "ABCD1234",
  "inviteToken": "...",
  "inviteUrl": "https://domain.com/room/ABCD1234?invite=...",
  "session": {
    "playerId": "...",
    "playerSecret": "..."
  },
  "snapshot": {}
}
```

### Join room

```txt
POST /api/rooms/:roomId/join
```

Input nuovo player:

```json
{
  "name": "Player 2",
  "inviteToken": "..."
}
```

Input reconnect stesso browser:

```json
{
  "name": "Player 2",
  "inviteToken": "...",
  "playerId": "...",
  "playerSecret": "..."
}
```

### Get state

```txt
GET /api/rooms/:roomId/state?playerId=...&playerSecret=...
```

Restituisce:

* stato pubblico
* eventi recenti
* mano privata solo del player autenticato

### Ready

```txt
POST /api/rooms/:roomId/ready
```

Input:

```json
{
  "playerId": "...",
  "playerSecret": "...",
  "ready": true
}
```

### Start game / next hand

```txt
POST /api/rooms/:roomId/start
```

Solo host.

Se la stanza e in `waiting` o `ready`, avvia la prima mano.

Se la stanza e in `hand_finished`, avvia la mano successiva.

### Play cards

```txt
POST /api/rooms/:roomId/play
```

Input:

```json
{
  "playerId": "...",
  "playerSecret": "...",
  "cardIds": ["spades-3", "clubs-3"]
}
```

Formato card id:

```txt
spades-3
clubs-A
hearts-10
diamonds-2
black_joker
red_joker
```

### Pass turn

```txt
POST /api/rooms/:roomId/pass
```

### Leave room

```txt
POST /api/rooms/:roomId/leave
```

### WebSocket

```txt
GET /api/rooms/:roomId/socket?playerId=...&playerSecret=...
```

Messaggi server -> client:

```json
{
  "type": "snapshot",
  "snapshot": {}
}
```

Il client puo inviare:

```txt
ping
```

e riceve:

```json
{ "type": "pong" }
```

Le azioni di gioco restano REST per semplicita; il WebSocket serve per sincronizzare tutti i client.

---

## Sessioni anonime

Non c'e account utente nella prima versione.

Quando un player crea o entra in una stanza, il Durable Object genera:

```txt
playerId
playerSecret
```

Il client salva questi valori in `localStorage`, separati per stanza.

Il `playerSecret` non va mai mostrato nella UI.

Serve solo a dimostrare che lo stesso browser puo continuare a controllare quel player.

---

## Durable Object Room State

Ogni stanza salva in storage:

```ts
type StoredRoom = {
  id: string;
  code: string;
  inviteToken: string;
  hostPlayerId: string;
  maxPlayers: number;
  phase: GamePhase;
  players: StoredPlayer[];
  gameState: GameState;
  events: RoomEvent[];
  nextEventId: number;
  createdAt: string;
  updatedAt: string;
};
```

Il `gameState` e lo stato autorevole.

Le mani private stanno dentro `gameState.players[].hand`, ma gli snapshot pubblici espongono solo `cardCount` agli altri player.

---

## Fasi stanza

```txt
waiting
ready
playing
hand_finished
game_finished
closed
```

Significato:

* `waiting`: lobby aperta, player insufficienti o non pronti
* `ready`: lobby valida, host puo iniziare
* `playing`: mano in corso
* `hand_finished`: mano conclusa, si puo iniziare la successiva
* `game_finished`: partita conclusa
* `closed`: stanza chiusa

---

## Motore regole

Il motore resta puro in `src/lib/game`.

Regole gia presenti:

* ordine carte: `3 ... A, 2, black_joker, red_joker`
* mazzo da 54 carte
* distribuzione completa 2-5 player
* prima mano aperta dal 3 di picche
* prima mossa deve contenere il 3 di picche
* singola, coppia, tris, poker, scala
* risposta solo stesso tipo e stessa lunghezza
* risposta con valore piu alto
* passaggio turno
* reset presa quando tutti passano
* fine mano quando resta un player con carte
* punteggio in base all'ordine di uscita
* target score incrementale in caso di pareggio sul target

Da verificare:

* se il 2 puo stare in scala
* se lo scambio carte dalla seconda mano va abilitato nella prima versione o resta variante futura

---

## Step 1 - Consolidare Worker

File:

```txt
src/worker/index.ts
src/worker/room.ts
src/worker/http.ts
src/worker/types.ts
```

Acceptance criteria:

* `npm run check` passa
* `npm run dev` avvia Wrangler
* `GET /api/health` risponde
* `POST /api/rooms` crea una stanza
* ogni codice stanza punta sempre allo stesso Durable Object

---

## Step 2 - Testare API stanza

Casi:

* create room
* join con invite token valido
* join con invite token invalido
* limite 5 player
* sesto player rifiutato
* reconnect con sessione valida
* reconnect con secret invalido rifiutato
* leave in lobby
* cambio host se host esce in lobby

---

## Step 3 - Testare partita

Casi:

* start game solo host
* start rifiutato sotto 2 player
* start rifiutato se player non ready
* carte distribuite server-side
* ogni player vede solo la propria mano
* prima mossa deve contenere 3 di picche
* giocata fuori turno rifiutata
* carte non possedute rifiutate
* combinazione invalida rifiutata
* passaggio turno valido
* tutti passano e il controllo torna all'ultimo player valido
* player chiude
* mano termina
* punteggi aggiornati
* partita termina con vincitore

---

## Step 4 - Collegare frontend

File:

```txt
src/routes/+page.svelte
src/routes/room/[roomId]/+page.svelte
src/lib/cloudflare/rooms.ts
src/lib/cloudflare/realtime.ts
src/lib/cloudflare/session.ts
```

Home:

* input nome
* crea stanza
* redirect a `/room/:roomId`

Room page:

* legge `roomId` dalla route
* legge `invite` dalla query
* se manca sessione mostra form join
* se esiste sessione chiama state
* apre WebSocket
* aggiorna UI con snapshot ricevuti

---

## Step 5 - Lobby UI

Componenti:

```txt
Lobby.svelte
InviteLink.svelte
PlayerList.svelte
ConnectionStatus.svelte
```

Acceptance criteria:

* codice stanza visibile
* link invito copiabile
* lista player visibile
* ready state visibile
* host badge
* Start Game solo host
* Start Game abilitato solo in fase `ready`

---

## Step 6 - Game UI

Componenti:

```txt
Card.svelte
Hand.svelte
Table.svelte
PlayerPanel.svelte
Scoreboard.svelte
ActionBar.svelte
GameLog.svelte
```

Acceptance criteria:

* mano ordinata
* selezione multipla carte
* card id usati per giocare
* ultima giocata visibile
* turno corrente evidente
* passaggi visibili
* carte rimanenti per player visibili
* punteggi visibili
* log eventi recente

---

## Step 7 - Reconnect UX

Acceptance criteria:

* refresh pagina mantiene sessione locale
* WebSocket si riconnette
* se la sessione e invalida, la UI chiede di rientrare
* stato `connected` cambia in modo comprensibile
* la stanza non si blocca se un player chiude tab

---

## Step 8 - Hardening concorrenza

Durable Objects serializzano le richieste per singola stanza, quindi due azioni simultanee sulla stessa stanza vengono processate in ordine.

Da verificare:

* doppio click su Gioca
* due client dello stesso player aperti
* pass e play quasi simultanei
* start game premuto due volte
* reconnect durante mano in corso

---

## Step 9 - Persistenza e retention

Prima versione:

* Durable Object storage mantiene stanza e stato
* eventi limitati agli ultimi 100
* nessuno storico globale

Possibili evoluzioni:

* aggiungere D1 per storico partite
* TTL logico stanze chiuse
* export replay mano

---

## Step 10 - Deploy

Comandi:

```txt
npm run check
npm run dev
npm run deploy
```

Acceptance criteria:

* Worker deployato
* Durable Object binding attivo
* migrazione Durable Object applicata
* create/join/start/play/pass funzionano in produzione
* WebSocket funziona in produzione

---

## Funzionalita escluse dalla prima versione

```txt
chat
account email/password
classifiche globali
matchmaking pubblico
spettatori
modalita torneo
bot multiplayer
acquisti
skin carte
database storico partite avanzato
anti-cheat sofisticato
```

---

## Definition of Done

Il progetto e completo quando:

* un utente puo creare una stanza
* il sistema genera un link invito
* altri utenti possono entrare dal link
* massimo 5 player possono partecipare
* l'host puo avviare la partita
* le carte vengono distribuite server-side
* ogni player vede solo la propria mano
* il turno viene gestito correttamente
* le giocate vengono validate server-side
* i passaggi funzionano
* la mano termina correttamente
* i punteggi vengono assegnati
* la partita puo arrivare a un vincitore
* il refresh pagina permette il reconnect
* la UI e leggibile su desktop e mobile
* Worker e Durable Object sono deployati
* il gioco e utilizzabile senza servizi backend esterni
