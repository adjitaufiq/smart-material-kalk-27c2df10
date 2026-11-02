<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- TACO price data lives only in src/lib/estimator/taco-pricing.ts; masters/engine read from it so price updates touch one file. Dynamic HPL ids `taco:<group>:<code>|<name>` keep KIS codes verbatim.
- Cabinet runs (same kind/height/depth/body, consecutive) share partitions in generatePartsForModules; outside HPL only on run-end sides — avoids double walls and over-buying board/HPL.
- Multi-item projects re-nest all parts jointly in mergeProjectBom (sheets, HPL, glue) — workshop cuts one batch, offcuts serve other items.
- Hinges = 1 set (2 pcs) per swing leaf (height/weight may add); AI QC derives hinge/slide/gas-spring from leaf counts read on the closed-door photo, never from counting hinges in open photos.
