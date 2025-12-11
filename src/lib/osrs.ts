// lib/osrs.ts
const SKILLS = [
    "Overall","Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic",
    "Cooking","Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining",
    "Herblore","Agility","Thieving","Slayer","Farming","Runecraft","Hunter","Construction","Sailing",
  ] as const;
  
  export type SkillName = (typeof SKILLS)[number];
  
  export type SkillStats = {
    rank: number;
    level: number;
    xp: number;
  };
  
  export type OsrsStatsResponse = {
    player: string;
    skills: Record<SkillName, SkillStats>;
    order: readonly SkillName[];
  };
  
  function sanitizeRSN(rsn: string) {
    return rsn.trim().replace(/\s+/g, "+");
  }
  
  function parseIndexLite(csv: string): Omit<OsrsStatsResponse, "player"> {
    const lines = csv.trim().split("\n");
    const skillsOnly = lines.slice(0, SKILLS.length);
  
    const skills: Record<string, SkillStats> = {};
  
    skillsOnly.forEach((line, i) => {
      const [rank, level, xp] = line.split(",").map(Number);
      skills[SKILLS[i]] = { rank, level, xp };
    });
  
    return { skills: skills as Record<SkillName, SkillStats>, order: SKILLS };
  }
  
  export async function fetchOsrsStats(player: string): Promise<OsrsStatsResponse> {
    const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${sanitizeRSN(
      player
    )}`;
  
    const res = await fetch(url);
  
    if (!res.ok) {
      throw new Error(`Upstream error ${res.status}`);
    }
  
    const csv = await res.text();
    const parsed = parseIndexLite(csv);
  
    return { player, ...parsed };
  }
  