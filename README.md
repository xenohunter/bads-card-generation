# B2B AI Dating SaaS - Card Generation

This repo features the pipeline for generation of all cards for the board game B2B AI Dating SaaS, and the consequent package of those cards into atlases fit to use in Tabletop Simulator.

## Generate the cards

```bash
yarn install
yarn generate:milestones
```

The script will recreate `outputs/milestones` and export a 490×490 PNG per milestone, with all card art rendered procedurally.
