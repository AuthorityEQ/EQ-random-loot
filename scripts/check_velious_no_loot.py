import sys, json
sys.stdout.reconfigure(encoding='utf-8')

with open("C:/Users/rontf/EQ-random-loot/data/velious-raid.json", encoding="utf-8") as f:
    data = json.load(f)

print("Bosses with EMPTY loot_pool:")
for tier in data["tiers"]:
    for boss in tier["bosses"]:
        if not boss.get("loot_pool"):
            print(f"  Tier {tier['tier']}: {boss['name']} ({boss['zone']})")
