import { CharacterGearPlanner } from "@/components/CharacterGearPlanner";

export default function CharactersPage() {
  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Loot Goblin</p>
          <h1>My Characters</h1>
          <p className="subhead">Choose an equipment slot to browse scored item recommendations.</p>
        </div>
      </header>

      <CharacterGearPlanner />
    </main>
  );
}
