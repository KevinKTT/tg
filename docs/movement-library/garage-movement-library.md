# the garage — Movement Library

Catalog of movements, warm-up drills, and cooldown/stretch items for the daily workout generator. Not workouts — building blocks only.

## Counts

**Main movements: 248**

| Category | Count | Uses only DB/rope/vest or nothing | Needs box |
|---|---|---|---|
| dumbbell | 93 | 86 | 2 |
| bodyweight | 83 | 72 | 1 |
| jump_rope | 19 | 19 | 0 |
| plyometric | 42 | 35 | 6 |
| weighted_vest | 11 | 7 | 1 |

Vest-compatible movements (`vest_compatible: true`): 100
Low-impact movements (`impact: low`): 180

**Warm-up drills: 94** — general_raise: 16, activation: 22, dynamic_mobility: 28, movement_prep: 28

**Stretch / cooldown items: 90** — static_stretch: 65, mobility: 7, foam_roll_or_soft_tissue: 11, breathing/downregulation: 7

Stretch coverage by area (items whose target_areas mention the area): neck: 5, shoulders: 13, thoracic: 7, chest: 7, lats: 10, wrists/forearms: 6, hips/flexors: 22, glutes: 11, hamstrings: 12, quads: 7, adductors: 9, calves/ankles: 15, low back: 21

## Note to the coding bot

- Files: `movements.json`, `warmups.json`, `stretches.json` (arrays of flat objects; field order matches the spec). CSV twins use `; ` to join arrays. `scaling_options` is an object `{"easier": [ids], "harder": [ids]}`; in CSV it is flattened as `easier: a; b | harder: c; d`. Booleans are `true`/`false` in CSV.
- `pattern_map.json` (bonus) = for each `movement_pattern`, the warm-up ids and stretch ids whose `pairs_with_patterns` include it, plus the movement count. Same data as the mapping section below.
- **Equipment arrays drive filtering.** A movement/drill/stretch is eligible only if every token in its `equipment` array is in the owners' owned-equipment set. `[]` = needs nothing but floor space. Equipment vocabulary used: `adjustable_bench`, `band`, `band_or_pvc`, `bench`, `box`, `dumbbell`, `foam_roller`, `hill_or_treadmill`, `hurdle`, `jump_rope`, `massage_ball`, `outdoor_trail`, `stairs`, `step`, `towel`, `wall`, `weighted_vest`.
  - `box` = plyo box or any stable surface you jump/step onto (filter these out if no box). `bench` = flat bench or couch/bench-height support (Bulgarian split squats, incline push-ups, bench dips). `adjustable_bench` = incline bench. `wall` = clear wall space. `band`, `band_or_pvc`, `foam_roller`, `massage_ball`, `towel`, `step`, `stairs`, `hurdle`, `hill_or_treadmill`, `outdoor_trail` are optional extras.
  - `jump_rope` and `weighted_vest` appear as equipment too, so a vest-category entry is filtered out if no vest is owned.
- `dumbbell_count`: 0 = no DB, 1 = one DB, 2 = a pair. If the owners only have one DB of a given weight, filter `dumbbell_count == 2`. (Exception: `lateral-jump-over-dumbbell` uses a DB only as an obstacle, so it lists `dumbbell` with count 0.)
- `vest_compatible: true` means the movement is a sensible place to add a weighted vest (bodyweight squats, lunges, push-ups, burpees, carries/walks, singles/DUs, low-amplitude jumps). It is deliberately `false` for all dumbbell lifts (load already comes from the DB), technical or high-amplitude plyos (tuck jumps, depth jumps, bounds, plyo push-ups), jump rope tricks, handstand/inverted work, and most supine core work (crunches, V-ups, hollow rocks). Sit-ups, planks, flutter kicks, mountain climbers, and bear crawls are `true` because vested versions are common in CrossFit hero-style workouts. The `weighted_vest` category holds the vest-specific entries (walks, rucks, stair climbs, etc.).
- `impact: low|high` lets you build quiet/joint-friendly days (filter `impact == "low"`). Every high-impact jump has a low-impact scaling partner (e.g. `step-jack`, `marching-high-knees`, `lateral-step-over`, `up-down`, `boxer-step`).
- `scaling_options` reference ids that exist in `movements.json` (validated). Swap to an easier id if equipment is missing or skill is too high.
- ids are globally unique across all three files: warm-ups are prefixed `wu-`, stretches `st-`. Some concepts appear in more than one file on purpose (e.g. `glute-bridge` as a movement and `wu-glute-bridge` as an activation drill) with different doses.
- Suggested rotation: pick the day's movement patterns → pull candidates from the pattern map → filter by equipment → exclude ids used in the last N days (store history) → sample. Aim for one `general_raise`, 1–2 `activation`, 2–3 `dynamic_mobility`, 1–2 `movement_prep`; and for cooldown 3–5 `static_stretch`/`mobility` + optionally one `foam_roll_or_soft_tissue` (if roller owned) + one `breathing/downregulation`. Breathing items map to every pattern.
- `modality` uses CrossFit's three: weightlifting (external load), gymnastics (bodyweight control), monostructural (cyclical: rope, running, walking/rucking, jacks).

## Pattern → warm-up / stretch mapping

### squat (16 movements)

**Warm-ups:** Easy Jog (`wu-easy-jog`), High-Knee March (`wu-high-knee-march`), Glute Bridge (activation) (`wu-glute-bridge`), Clamshell (`wu-clamshell`), Side-Lying Leg Raise (`wu-side-lying-leg-raise`), Fire Hydrant (`wu-fire-hydrant`), Banded Lateral Walk (`wu-band-lateral-walk`), Dead Bug (activation) (`wu-dead-bug`), Leg Swings (Side-to-Side) (`wu-leg-swings-lateral`), Standing Hip Circles (`wu-hip-circles`), Walking Knee Hug (`wu-walking-knee-hug`), World's Greatest Stretch (`wu-worlds-greatest-stretch`), Spiderman Lunge (`wu-spiderman-lunge`), Squat-to-Stand (`wu-squat-to-stand`), Samson Stretch (`wu-samson-stretch`), 90/90 Hip Switches (`wu-9090-hip-switch`), Knee-to-Wall Ankle Rocks (`wu-ankle-rocks`), Cossack Shifts (`wu-cossack-shift`), Deep Squat Pry (`wu-deep-squat-pry`), Light Dumbbell Complex (`wu-db-complex-light`), Dumbbell Clean Progression (`wu-db-clean-progression`), Tempo Goblet Squat (`wu-goblet-squat-tempo`), Air Squat Build-Up (`wu-air-squat-build`), Snap-Down (`wu-snap-down`), Split Squat Isometric Hold (`wu-split-squat-iso`)

**Stretches/cooldown:** Child's Pose (`st-childs-pose`), Half-Kneeling Hip Flexor Stretch (`st-kneeling-hip-flexor`), Couch Stretch (`st-couch-stretch`), Pigeon Stretch (`st-pigeon`), 90/90 Hip Stretch (`st-9090-hip`), Supine 90-90 Hip Rotator Stretch (`st-supine-9090`), Deep Squat Hold (`st-deep-squat-hold`), Happy Baby (`st-happy-baby`), Hip Controlled Articular Rotations (`st-hip-cars`), Supine Figure-Four Stretch (`st-figure-four`), Seated Figure-Four Stretch (`st-seated-figure-four`), Knee-to-Opposite-Shoulder Stretch (`st-knee-to-opposite-shoulder`), Single Knee-to-Chest (`st-single-knee-to-chest`), Double Knee-to-Chest (`st-double-knee-to-chest`), Standing Forward Fold (`st-standing-forward-fold`), Standing Quad Stretch (`st-standing-quad`), Side-Lying Quad Stretch (`st-side-lying-quad`), Kneeling Quad Stretch (`st-kneeling-quad`), Wall Calf Stretch (Straight Knee) (`st-wall-calf`), Wall Soleus Stretch (Bent Knee) (`st-wall-soleus`), Ankle Circles (`st-ankle-cars`), Butterfly Stretch (`st-butterfly`), Frog Stretch (`st-frog`), Seated Straddle Stretch (`st-seated-straddle`), Seated Side Straddle Stretch (`st-side-straddle`), Side Lunge Stretch (`st-side-lunge-hold`), Quadruped Adductor Rock-Back (`st-adductor-rockback`), Foam Roll Quadriceps (`st-roll-quads`), Foam Roll Adductors (`st-roll-adductors`), Foam Roll Glutes (`st-roll-glutes`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`), Legs Up the Wall (`st-legs-up-wall`), 90/90 Wall Breathing (`st-9090-breathing`)

### hinge (15 movements)

**Warm-ups:** Glute Bridge (activation) (`wu-glute-bridge`), Single-Leg Glute Bridge (activation) (`wu-single-leg-glute-bridge`), Quadruped Hip Extension (`wu-quadruped-hip-extension`), Bird Dog (activation) (`wu-bird-dog`), Dead Bug (activation) (`wu-dead-bug`), Superman Hold (activation) (`wu-superman-hold`), Single-Leg Balance Reach (`wu-single-leg-balance`), Glute Bridge March (activation) (`wu-glute-bridge-march`), Leg Swings (Front-to-Back) (`wu-leg-swings-front`), Frankenstein Walk (`wu-frankensteins`), Cat-Cow (`wu-cat-cow`), World's Greatest Stretch (`wu-worlds-greatest-stretch`), Inchworm (warm-up) (`wu-inchworm`), Down Dog to Cobra Flow (`wu-down-dog-to-cobra`), Squat-to-Stand (`wu-squat-to-stand`), Prone Scorpion (`wu-scorpion`), Light Dumbbell Complex (`wu-db-complex-light`), Dumbbell Snatch Progression (`wu-db-snatch-progression`), Dumbbell Clean Progression (`wu-db-clean-progression`), Light Dumbbell RDL (`wu-db-rdl-light`), Hip Hinge Drill (`wu-hip-hinge-drill`), Light Farmers Hold (`wu-farmer-hold-light`)

**Stretches/cooldown:** Upper Trapezius Stretch (`st-upper-trap-stretch`), Seated Spinal Twist (`st-seated-spinal-twist`), Supine Spinal Twist (`st-supine-twist`), Sphinx Pose (`st-sphinx`), Cobra Stretch (`st-cobra`), Child's Pose (`st-childs-pose`), Pigeon Stretch (`st-pigeon`), Supine 90-90 Hip Rotator Stretch (`st-supine-9090`), Happy Baby (`st-happy-baby`), Supine Figure-Four Stretch (`st-figure-four`), Seated Figure-Four Stretch (`st-seated-figure-four`), Knee-to-Opposite-Shoulder Stretch (`st-knee-to-opposite-shoulder`), Single Knee-to-Chest (`st-single-knee-to-chest`), Double Knee-to-Chest (`st-double-knee-to-chest`), Supine Hamstring Stretch (`st-supine-hamstring`), Seated Forward Fold (`st-seated-toe-touch`), Modified Hurdler's Stretch (`st-modified-hurdler`), Half-Kneeling Hamstring Stretch (`st-half-kneeling-hamstring`), Standing Forward Fold (`st-standing-forward-fold`), Wall Hamstring Stretch (`st-wall-hamstring`), Downward-Facing Dog (`st-downward-dog`), Seated Straddle Stretch (`st-seated-straddle`), Slow Cat-Camel (`st-cat-camel-cooldown`), Supine Pelvic Tilts (`st-pelvic-tilt`), Foam Roll Glutes (`st-roll-glutes`), Foam Roll Hamstrings (`st-roll-hamstrings`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), Crocodile Breathing (`st-crocodile-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`), 90/90 Wall Breathing (`st-9090-breathing`)

### lunge (23 movements)

**Warm-ups:** Easy Jog (`wu-easy-jog`), High-Knee March (`wu-high-knee-march`), Butt Kicks (`wu-butt-kicks`), Carioca (`wu-carioca`), Lateral Shuffle Warm-Up (`wu-lateral-shuffle`), Glute Bridge (activation) (`wu-glute-bridge`), Single-Leg Glute Bridge (activation) (`wu-single-leg-glute-bridge`), Clamshell (`wu-clamshell`), Side-Lying Leg Raise (`wu-side-lying-leg-raise`), Fire Hydrant (`wu-fire-hydrant`), Quadruped Hip Extension (`wu-quadruped-hip-extension`), Banded Lateral Walk (`wu-band-lateral-walk`), Side Plank (activation) (`wu-side-plank`), Single-Leg Balance Reach (`wu-single-leg-balance`), Glute Bridge March (activation) (`wu-glute-bridge-march`), Leg Swings (Front-to-Back) (`wu-leg-swings-front`), Leg Swings (Side-to-Side) (`wu-leg-swings-lateral`), Standing Hip Circles (`wu-hip-circles`), Walking Knee Hug (`wu-walking-knee-hug`), Walking Quad Pull (`wu-walking-quad-pull`), World's Greatest Stretch (`wu-worlds-greatest-stretch`), Spiderman Lunge (`wu-spiderman-lunge`), Samson Stretch (`wu-samson-stretch`), 90/90 Hip Switches (`wu-9090-hip-switch`), Knee-to-Wall Ankle Rocks (`wu-ankle-rocks`), Walking Lunge with Overhead Reach (`wu-walking-lunge-reach`), Reverse Lunge with Twist (`wu-reverse-lunge-twist`), Cossack Shifts (`wu-cossack-shift`), Prone Scorpion (`wu-scorpion`), Tempo Goblet Squat (`wu-goblet-squat-tempo`), Air Squat Build-Up (`wu-air-squat-build`), Split-Stance Snap-Down (`wu-split-stance-stick`), Split Squat Isometric Hold (`wu-split-squat-iso`)

**Stretches/cooldown:** Half-Kneeling Hip Flexor Stretch (`st-kneeling-hip-flexor`), Couch Stretch (`st-couch-stretch`), Low Lunge (`st-low-lunge`), Pigeon Stretch (`st-pigeon`), 90/90 Hip Stretch (`st-9090-hip`), Supine 90-90 Hip Rotator Stretch (`st-supine-9090`), Hip Controlled Articular Rotations (`st-hip-cars`), Standing Iliotibial Band Stretch (`st-standing-it-band`), Supine Figure-Four Stretch (`st-figure-four`), Knee-to-Opposite-Shoulder Stretch (`st-knee-to-opposite-shoulder`), Supine Hamstring Stretch (`st-supine-hamstring`), Half-Kneeling Hamstring Stretch (`st-half-kneeling-hamstring`), Standing Quad Stretch (`st-standing-quad`), Side-Lying Quad Stretch (`st-side-lying-quad`), Kneeling Quad Stretch (`st-kneeling-quad`), Butterfly Stretch (`st-butterfly`), Frog Stretch (`st-frog`), Seated Straddle Stretch (`st-seated-straddle`), Seated Side Straddle Stretch (`st-side-straddle`), Side Lunge Stretch (`st-side-lunge-hold`), Quadruped Adductor Rock-Back (`st-adductor-rockback`), Foam Roll Quadriceps (`st-roll-quads`), Foam Roll Lateral Thigh (`st-roll-it-band`), Foam Roll Adductors (`st-roll-adductors`), Foam Roll Glutes (`st-roll-glutes`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`), Legs Up the Wall (`st-legs-up-wall`)

### horizontal push (20 movements)

**Warm-ups:** Shadow Boxing (`wu-shadow-boxing`), Bear Crawl Warm-Up (`wu-bear-crawl`), Slow Mountain Climbers (`wu-slow-mountain-climbers`), Band Pull-Apart (`wu-band-pull-apart`), Plank Hold (activation) (`wu-plank-hold`), Scap Push-Up (`wu-scap-push-up`), Side-Lying Dumbbell External Rotation (`wu-db-external-rotation`), Bear Hold Shoulder Taps (`wu-bear-hold-shoulder-tap`), Arm Circles (`wu-arm-circles`), Cross-Body Arm Swings (`wu-arm-swings`), Open Book (`wu-open-book`), Inchworm (warm-up) (`wu-inchworm`), Down Dog to Cobra Flow (`wu-down-dog-to-cobra`), Hip Rotations in Push-Up Position (`wu-hip-rotations-push-up`), Wrist Circles and Rocks (`wu-wrist-prep`), Band or PVC Pass-Through (`wu-pass-through`), Push-Up Negatives (`wu-push-up-negatives`), Burpee Breakdown (`wu-burpee-breakdown`)

**Stretches/cooldown:** Chin Tucks (`st-chin-tuck`), Cross-Body Shoulder Stretch (`st-cross-body-shoulder`), Sleeper Stretch (`st-sleeper-stretch`), Overhead Triceps Stretch (`st-overhead-triceps`), Standing Shoulder Extension Stretch (`st-shoulder-extension`), Standing Chest Stretch (`st-standing-chest`), Doorway Pec Stretch (`st-doorway-pec`), Prone Single-Arm Pec Stretch (`st-prone-pec`), Open Book Hold (`st-open-book-hold`), Foam Roller Thoracic Extension (`st-foam-roll-t-spine`), Upward-Facing Dog (`st-upward-dog`), Wrist Flexor Stretch (`st-wrist-flexor`), Prayer Stretch (`st-prayer-stretch`), Kneeling Wrist Stretch (Fingers Back) (`st-kneeling-wrist-stretch`), Massage Ball Pec Release (`st-ball-pec`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

### vertical push (17 movements)

**Warm-ups:** Light Jumping Jacks (`wu-light-jumping-jacks`), Bear Crawl Warm-Up (`wu-bear-crawl`), Step Jacks (`wu-step-jacks`), Band Pull-Apart (`wu-band-pull-apart`), Dead Bug (activation) (`wu-dead-bug`), Hollow Hold (activation) (`wu-hollow-hold`), Scap Push-Up (`wu-scap-push-up`), Prone Y-T-W Raises (`wu-prone-ytw`), Side-Lying Dumbbell External Rotation (`wu-db-external-rotation`), Arm Circles (`wu-arm-circles`), Cross-Body Arm Swings (`wu-arm-swings`), Thread the Needle (dynamic) (`wu-thread-the-needle`), Open Book (`wu-open-book`), Down Dog to Cobra Flow (`wu-down-dog-to-cobra`), Samson Stretch (`wu-samson-stretch`), Wrist Circles and Rocks (`wu-wrist-prep`), Neck Half Circles (`wu-neck-half-circles`), Band or PVC Pass-Through (`wu-pass-through`), Walking Lunge with Overhead Reach (`wu-walking-lunge-reach`), Light Dumbbell Complex (`wu-db-complex-light`), Dumbbell Snatch Progression (`wu-db-snatch-progression`), Dip-Drive Drill (`wu-db-push-press-drill`), Turkish Get-Up Practice (Unloaded) (`wu-tgu-practice`), Light Dumbbell Halo (`wu-db-halo`), Push-Up Negatives (`wu-push-up-negatives`), Pike Shoulder Shrug (`wu-pike-shoulder-shrug`)

**Stretches/cooldown:** Upper Trapezius Stretch (`st-upper-trap-stretch`), Levator Scapulae Stretch (`st-levator-scapulae-stretch`), Neck Flexion and Extension (`st-neck-flexion-extension`), Chin Tucks (`st-chin-tuck`), Scalene Stretch (`st-scalene-stretch`), Cross-Body Shoulder Stretch (`st-cross-body-shoulder`), Sleeper Stretch (`st-sleeper-stretch`), Overhead Triceps Stretch (`st-overhead-triceps`), Standing Shoulder Extension Stretch (`st-shoulder-extension`), Standing Chest Stretch (`st-standing-chest`), Doorway Pec Stretch (`st-doorway-pec`), Prone Single-Arm Pec Stretch (`st-prone-pec`), Puppy Pose (`st-puppy-pose`), Thread the Needle Hold (`st-thread-the-needle-hold`), Bench Thoracic Extension Stretch (`st-bench-thoracic-extension`), Foam Roller Thoracic Extension (`st-foam-roll-t-spine`), Child's Pose (`st-childs-pose`), Side-Reach Child's Pose (`st-side-reach-childs-pose`), 90 Lat Stretch (`st-90-lat-stretch`), Kneeling Lat Stretch on Bench (`st-kneeling-lat-bench`), Standing Side Bend (`st-standing-side-bend`), Wrist Flexor Stretch (`st-wrist-flexor`), Prayer Stretch (`st-prayer-stretch`), Kneeling Wrist Stretch (Fingers Back) (`st-kneeling-wrist-stretch`), Downward-Facing Dog (`st-downward-dog`), Foam Roll Lats (`st-roll-lats`), Massage Ball Pec Release (`st-ball-pec`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

### horizontal pull (7 movements)

**Warm-ups:** Band Pull-Apart (`wu-band-pull-apart`), Superman Hold (activation) (`wu-superman-hold`), Prone Y-T-W Raises (`wu-prone-ytw`), Arm Circles (`wu-arm-circles`), Cross-Body Arm Swings (`wu-arm-swings`), Thread the Needle (dynamic) (`wu-thread-the-needle`), Open Book (`wu-open-book`), Light Single-Arm Row (`wu-db-single-arm-row-light`)

**Stretches/cooldown:** Levator Scapulae Stretch (`st-levator-scapulae-stretch`), Cross-Body Shoulder Stretch (`st-cross-body-shoulder`), Seated Biceps Stretch (`st-biceps-stretch`), Puppy Pose (`st-puppy-pose`), Thread the Needle Hold (`st-thread-the-needle-hold`), 90 Lat Stretch (`st-90-lat-stretch`), Wrist Extensor Stretch (`st-wrist-extensor`), Reverse Prayer Stretch (`st-reverse-prayer`), Forearm Soft-Tissue Roll (`st-forearm-smash`), Foam Roll Lats (`st-roll-lats`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

### vertical pull (3 movements)

**Warm-ups:** Band Pull-Apart (`wu-band-pull-apart`), Prone Y-T-W Raises (`wu-prone-ytw`), Arm Circles (`wu-arm-circles`), Band or PVC Pass-Through (`wu-pass-through`), Light Dumbbell Halo (`wu-db-halo`), Light Single-Arm Row (`wu-db-single-arm-row-light`)

**Stretches/cooldown:** Seated Biceps Stretch (`st-biceps-stretch`), Puppy Pose (`st-puppy-pose`), Side-Reach Child's Pose (`st-side-reach-childs-pose`), 90 Lat Stretch (`st-90-lat-stretch`), Kneeling Lat Stretch on Bench (`st-kneeling-lat-bench`), Foam Roll Lats (`st-roll-lats`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

### carry (6 movements)

**Warm-ups:** Bird Dog (activation) (`wu-bird-dog`), Plank Hold (activation) (`wu-plank-hold`), Side Plank (activation) (`wu-side-plank`), Bear Hold Shoulder Taps (`wu-bear-hold-shoulder-tap`), Neck Half Circles (`wu-neck-half-circles`), Easy Vest Walk (`wu-vest-walk-easy`), Light Farmers Hold (`wu-farmer-hold-light`)

**Stretches/cooldown:** Upper Trapezius Stretch (`st-upper-trap-stretch`), Levator Scapulae Stretch (`st-levator-scapulae-stretch`), Neck Flexion and Extension (`st-neck-flexion-extension`), Chin Tucks (`st-chin-tuck`), Scalene Stretch (`st-scalene-stretch`), Standing Shoulder Extension Stretch (`st-shoulder-extension`), Seated Biceps Stretch (`st-biceps-stretch`), Standing Side Bend (`st-standing-side-bend`), Wrist Flexor Stretch (`st-wrist-flexor`), Wrist Extensor Stretch (`st-wrist-extensor`), Reverse Prayer Stretch (`st-reverse-prayer`), Forearm Soft-Tissue Roll (`st-forearm-smash`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), Crocodile Breathing (`st-crocodile-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

### core/midline (31 movements)

**Warm-ups:** Bear Crawl Warm-Up (`wu-bear-crawl`), Slow Mountain Climbers (`wu-slow-mountain-climbers`), Bird Dog (activation) (`wu-bird-dog`), Dead Bug (activation) (`wu-dead-bug`), Plank Hold (activation) (`wu-plank-hold`), Side Plank (activation) (`wu-side-plank`), Hollow Hold (activation) (`wu-hollow-hold`), Bear Hold Shoulder Taps (`wu-bear-hold-shoulder-tap`), Cat-Cow (`wu-cat-cow`), Inchworm (warm-up) (`wu-inchworm`), Down Dog to Cobra Flow (`wu-down-dog-to-cobra`), Hip Rotations in Push-Up Position (`wu-hip-rotations-push-up`), Wrist Circles and Rocks (`wu-wrist-prep`), Turkish Get-Up Practice (Unloaded) (`wu-tgu-practice`), Light Dumbbell Halo (`wu-db-halo`)

**Stretches/cooldown:** Seated Spinal Twist (`st-seated-spinal-twist`), Supine Spinal Twist (`st-supine-twist`), Sphinx Pose (`st-sphinx`), Cobra Stretch (`st-cobra`), Upward-Facing Dog (`st-upward-dog`), Child's Pose (`st-childs-pose`), Kneeling Wrist Stretch (Fingers Back) (`st-kneeling-wrist-stretch`), Double Knee-to-Chest (`st-double-knee-to-chest`), Slow Cat-Camel (`st-cat-camel-cooldown`), Supine Pelvic Tilts (`st-pelvic-tilt`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), Crocodile Breathing (`st-crocodile-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`), 90/90 Wall Breathing (`st-9090-breathing`)

### jump (54 movements)

**Warm-ups:** Easy Jog (`wu-easy-jog`), Jog in Place (`wu-jog-in-place`), Light Jumping Jacks (`wu-light-jumping-jacks`), Easy Single-Unders (`wu-easy-single-unders`), Jump Rope Boxer Step Warm-Up (`wu-jump-rope-boxer-step`), Butt Kicks (`wu-butt-kicks`), A-Skip (`wu-a-skip`), Lateral Shuffle Warm-Up (`wu-lateral-shuffle`), Backpedal (`wu-backpedal`), Forward Skip (`wu-forward-skip`), Glute Bridge (activation) (`wu-glute-bridge`), Single-Leg Glute Bridge (activation) (`wu-single-leg-glute-bridge`), Clamshell (`wu-clamshell`), Side-Lying Leg Raise (`wu-side-lying-leg-raise`), Fire Hydrant (`wu-fire-hydrant`), Banded Lateral Walk (`wu-band-lateral-walk`), Hollow Hold (activation) (`wu-hollow-hold`), Tibialis Raise (`wu-tibialis-raise`), Calf Raise (activation) (`wu-calf-raise`), Single-Leg Balance Reach (`wu-single-leg-balance`), Leg Swings (Front-to-Back) (`wu-leg-swings-front`), Walking Quad Pull (`wu-walking-quad-pull`), Knee-to-Wall Ankle Rocks (`wu-ankle-rocks`), Air Squat Build-Up (`wu-air-squat-build`), Burpee Breakdown (`wu-burpee-breakdown`), Penguin Jumps (`wu-penguin-jumps`), Rope Handle Flicks (No Jump) (`wu-rope-handle-flicks`), Single-Single-Double Drill (`wu-single-single-double`), High Single-Unders (`wu-high-singles`), Pogo Hops (prep) (`wu-pogo-hops`), Snap-Down (`wu-snap-down`), Squat Jump to Stick (`wu-jump-to-stick`), Split-Stance Snap-Down (`wu-split-stance-stick`), Single-Leg Hop to Stick (prep) (`wu-single-leg-hop-stick`), Low Line Hops (`wu-low-line-hops`), Build-Up Strides (`wu-run-strides`)

**Stretches/cooldown:** Half-Kneeling Hip Flexor Stretch (`st-kneeling-hip-flexor`), Couch Stretch (`st-couch-stretch`), Standing Iliotibial Band Stretch (`st-standing-it-band`), Modified Hurdler's Stretch (`st-modified-hurdler`), Standing Quad Stretch (`st-standing-quad`), Kneeling Quad Stretch (`st-kneeling-quad`), Wall Calf Stretch (Straight Knee) (`st-wall-calf`), Wall Soleus Stretch (Bent Knee) (`st-wall-soleus`), Downward-Facing Dog (`st-downward-dog`), Step Calf Stretch (`st-step-calf`), Seated Calf Stretch with Towel (`st-seated-calf-towel`), Kneeling Shin Stretch (`st-kneeling-shin`), Toe Sit (`st-toe-sit`), Ankle Circles (`st-ankle-cars`), Foam Roll Quadriceps (`st-roll-quads`), Foam Roll Lateral Thigh (`st-roll-it-band`), Foam Roll Calves (`st-roll-calves`), Massage Ball Foot Roll (`st-ball-foot`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`), Legs Up the Wall (`st-legs-up-wall`)

### locomotion (23 movements)

**Warm-ups:** Easy Jog (`wu-easy-jog`), Jog in Place (`wu-jog-in-place`), Light Jumping Jacks (`wu-light-jumping-jacks`), Easy Single-Unders (`wu-easy-single-unders`), Jump Rope Boxer Step Warm-Up (`wu-jump-rope-boxer-step`), High-Knee March (`wu-high-knee-march`), Butt Kicks (`wu-butt-kicks`), A-Skip (`wu-a-skip`), Carioca (`wu-carioca`), Lateral Shuffle Warm-Up (`wu-lateral-shuffle`), Backpedal (`wu-backpedal`), Forward Skip (`wu-forward-skip`), Shadow Boxing (`wu-shadow-boxing`), Bear Crawl Warm-Up (`wu-bear-crawl`), Slow Mountain Climbers (`wu-slow-mountain-climbers`), Step Jacks (`wu-step-jacks`), Side-Lying Leg Raise (`wu-side-lying-leg-raise`), Tibialis Raise (`wu-tibialis-raise`), Calf Raise (activation) (`wu-calf-raise`), Glute Bridge March (activation) (`wu-glute-bridge-march`), Leg Swings (Front-to-Back) (`wu-leg-swings-front`), Leg Swings (Side-to-Side) (`wu-leg-swings-lateral`), Standing Hip Circles (`wu-hip-circles`), Frankenstein Walk (`wu-frankensteins`), Walking Knee Hug (`wu-walking-knee-hug`), Walking Quad Pull (`wu-walking-quad-pull`), Spiderman Lunge (`wu-spiderman-lunge`), Walking Lunge with Overhead Reach (`wu-walking-lunge-reach`), Pogo Hops (prep) (`wu-pogo-hops`), Single-Leg Hop to Stick (prep) (`wu-single-leg-hop-stick`), Build-Up Strides (`wu-run-strides`), Easy Vest Walk (`wu-vest-walk-easy`)

**Stretches/cooldown:** Half-Kneeling Hip Flexor Stretch (`st-kneeling-hip-flexor`), Couch Stretch (`st-couch-stretch`), Low Lunge (`st-low-lunge`), Pigeon Stretch (`st-pigeon`), Hip Controlled Articular Rotations (`st-hip-cars`), Standing Iliotibial Band Stretch (`st-standing-it-band`), Supine Figure-Four Stretch (`st-figure-four`), Seated Figure-Four Stretch (`st-seated-figure-four`), Supine Hamstring Stretch (`st-supine-hamstring`), Modified Hurdler's Stretch (`st-modified-hurdler`), Half-Kneeling Hamstring Stretch (`st-half-kneeling-hamstring`), Wall Hamstring Stretch (`st-wall-hamstring`), Standing Quad Stretch (`st-standing-quad`), Side-Lying Quad Stretch (`st-side-lying-quad`), Wall Calf Stretch (Straight Knee) (`st-wall-calf`), Wall Soleus Stretch (Bent Knee) (`st-wall-soleus`), Downward-Facing Dog (`st-downward-dog`), Step Calf Stretch (`st-step-calf`), Seated Calf Stretch with Towel (`st-seated-calf-towel`), Kneeling Shin Stretch (`st-kneeling-shin`), Toe Sit (`st-toe-sit`), Ankle Circles (`st-ankle-cars`), Side Lunge Stretch (`st-side-lunge-hold`), Foam Roll Quadriceps (`st-roll-quads`), Foam Roll Lateral Thigh (`st-roll-it-band`), Foam Roll Calves (`st-roll-calves`), Foam Roll Hamstrings (`st-roll-hamstrings`), Massage Ball Foot Roll (`st-ball-foot`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`), Legs Up the Wall (`st-legs-up-wall`)

### full-body/olympic-style (25 movements)

**Warm-ups:** Band Pull-Apart (`wu-band-pull-apart`), Hollow Hold (activation) (`wu-hollow-hold`), Superman Hold (activation) (`wu-superman-hold`), Prone Y-T-W Raises (`wu-prone-ytw`), Side-Lying Dumbbell External Rotation (`wu-db-external-rotation`), Arm Circles (`wu-arm-circles`), Cat-Cow (`wu-cat-cow`), Thread the Needle (dynamic) (`wu-thread-the-needle`), World's Greatest Stretch (`wu-worlds-greatest-stretch`), Wrist Circles and Rocks (`wu-wrist-prep`), Neck Half Circles (`wu-neck-half-circles`), Band or PVC Pass-Through (`wu-pass-through`), Deep Squat Pry (`wu-deep-squat-pry`), Light Dumbbell Complex (`wu-db-complex-light`), Dumbbell Snatch Progression (`wu-db-snatch-progression`), Dumbbell Clean Progression (`wu-db-clean-progression`), Dip-Drive Drill (`wu-db-push-press-drill`), Light Dumbbell RDL (`wu-db-rdl-light`), Hip Hinge Drill (`wu-hip-hinge-drill`), Turkish Get-Up Practice (Unloaded) (`wu-tgu-practice`), Light Dumbbell Halo (`wu-db-halo`), Burpee Breakdown (`wu-burpee-breakdown`)

**Stretches/cooldown:** Upper Trapezius Stretch (`st-upper-trap-stretch`), Neck Flexion and Extension (`st-neck-flexion-extension`), Cross-Body Shoulder Stretch (`st-cross-body-shoulder`), Sleeper Stretch (`st-sleeper-stretch`), Overhead Triceps Stretch (`st-overhead-triceps`), Puppy Pose (`st-puppy-pose`), Bench Thoracic Extension Stretch (`st-bench-thoracic-extension`), Foam Roller Thoracic Extension (`st-foam-roll-t-spine`), Side-Reach Child's Pose (`st-side-reach-childs-pose`), 90 Lat Stretch (`st-90-lat-stretch`), Kneeling Lat Stretch on Bench (`st-kneeling-lat-bench`), Wrist Flexor Stretch (`st-wrist-flexor`), Wrist Extensor Stretch (`st-wrist-extensor`), Forearm Soft-Tissue Roll (`st-forearm-smash`), Deep Squat Hold (`st-deep-squat-hold`), Supine Hamstring Stretch (`st-supine-hamstring`), Seated Forward Fold (`st-seated-toe-touch`), Standing Forward Fold (`st-standing-forward-fold`), Slow Cat-Camel (`st-cat-camel-cooldown`), Foam Roll Lats (`st-roll-lats`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

### rotation (8 movements)

**Warm-ups:** Carioca (`wu-carioca`), Shadow Boxing (`wu-shadow-boxing`), Thread the Needle (dynamic) (`wu-thread-the-needle`), Open Book (`wu-open-book`), World's Greatest Stretch (`wu-worlds-greatest-stretch`), Hip Rotations in Push-Up Position (`wu-hip-rotations-push-up`), 90/90 Hip Switches (`wu-9090-hip-switch`), Reverse Lunge with Twist (`wu-reverse-lunge-twist`), Prone Scorpion (`wu-scorpion`)

**Stretches/cooldown:** Thread the Needle Hold (`st-thread-the-needle-hold`), Open Book Hold (`st-open-book-hold`), Seated Spinal Twist (`st-seated-spinal-twist`), Supine Spinal Twist (`st-supine-twist`), Standing Side Bend (`st-standing-side-bend`), 90/90 Hip Stretch (`st-9090-hip`), Hip Controlled Articular Rotations (`st-hip-cars`), Seated Side Straddle Stretch (`st-side-straddle`), Box Breathing (`st-box-breathing`), Supine Diaphragmatic Breathing (`st-diaphragmatic-breathing`), 4-7-8 Breathing (`st-478-breathing`), Cyclic Sighing (`st-cyclic-sighing`)

## Movements by category

### dumbbell (93)

| Name | id | Equipment | DBs | Pattern | Skill | Intensity | Impact | Vest | Unit | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Dumbbell Deadlift | `db-deadlift` | dumbbell | 2 | hinge | beginner | moderate | low | no | reps | Hinge at the hips with a neutral spine to lower two dumbbells beside the feet, then stand up to full hip extension. [src](https://www.crossfit.com/essentials/the-dumbbell-deadlift) |
| Dumbbell Suitcase Deadlift | `db-suitcase-deadlift` | dumbbell | 1 | hinge | beginner | moderate | low | no | reps | Deadlift one dumbbell held at one side, resisting lean so the torso stays square. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Romanian Deadlift | `db-romanian-deadlift` | dumbbell | 2 | hinge | beginner | moderate | low | no | reps | From standing, push the hips back with soft knees, sliding the dumbbells down the thighs to mid-shin, then drive the hips forward. [src](https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/) |
| Dumbbell Staggered-Stance RDL | `db-staggered-stance-rdl` | dumbbell | 2 | hinge | intermediate | moderate | low | no | reps | Perform an RDL with most weight on the front leg and the back toe resting lightly behind for balance. [src](https://spmembersonly.com/pp-movement-library) |
| Dumbbell Single-Leg Romanian Deadlift | `db-single-leg-romanian-deadlift` | dumbbell | 1 | hinge | intermediate | moderate | low | no | reps | Balance on one leg and hinge forward, reaching the dumbbell toward the floor while the free leg extends behind, then return tall. [src](https://barbend.com/single-leg-romanian-deadlift/) |
| Dumbbell Sumo Deadlift | `db-sumo-deadlift` | dumbbell | 1 | hinge | beginner | moderate | low | no | reps | With a wide stance and toes out, hold one dumbbell vertically between the legs and stand up by driving the knees out and hips through. [src](https://spmembersonly.com/pp-movement-library) |
| Dumbbell Sumo Deadlift High Pull | `db-sumo-deadlift-high-pull` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | From a sumo deadlift, extend the hips explosively and pull the dumbbell to chin height with elbows high and outside. [src](https://www.crossfit.com/essentials/the-sumo-deadlift-high-pull) |
| Dumbbell Goblet Good Morning | `db-goblet-good-morning` | dumbbell | 1 | hinge | intermediate | low | low | no | reps | Hold a dumbbell at the chest and hinge at the hips with soft knees until the torso nears parallel, then return. [src](https://www.crossfit.com/essentials/the-good-morning) |
| Dumbbell Single-Arm Swing | `db-single-arm-swing` | dumbbell | 1 | hinge | intermediate | high | low | no | reps | Hike the dumbbell between the legs and snap the hips to float it to eye level or overhead with a straight arm. [src](https://www.acefitness.org/resources/everyone/exercise-library/392/single-arm-swing/) |
| Dumbbell Glute Bridge | `db-glute-bridge` | dumbbell | 1 | hinge | beginner | low | low | no | reps | Lie on your back with a dumbbell across the hips, feet planted, and drive the hips up until knees, hips, and shoulders align. [src](https://www.acefitness.org/resources/everyone/exercise-library/367/elevated-glute-bridge/) |
| Dumbbell Hip Thrust | `db-hip-thrust` | dumbbell, bench | 1 | hinge | beginner | moderate | low | no | reps | With upper back on a bench and a dumbbell on the hips, drive the hips up to full extension and squeeze the glutes. [src](https://www.acefitness.org/resources/everyone/exercise-library/367/elevated-glute-bridge/) |
| Dumbbell Hang Power Clean | `db-hang-power-clean` | dumbbell | 2 | full-body/olympic-style | intermediate | high | low | no | reps | From the hang at mid-thigh, jump and shrug to pull the dumbbells up and receive them on the shoulders in a partial squat. [src](https://www.crossfit.com/essentials/the-dumbbell-hang-power-clean) |
| Dumbbell Power Clean | `db-power-clean` | dumbbell | 2 | full-body/olympic-style | intermediate | high | low | no | reps | Lift the dumbbells from the floor, extend the hips explosively, and receive them on the shoulders in a partial squat. [src](https://www.crossfit.com/essentials/the-dumbbell-power-clean) |
| Dumbbell Squat Clean | `db-squat-clean` | dumbbell | 2 | full-body/olympic-style | intermediate | high | low | no | reps | Clean the dumbbells from the floor and receive them on the shoulders in a full front squat before standing. [src](https://www.crossfit.com/essentials/the-dumbbell-clean) |
| Dumbbell Hang Squat Clean | `db-hang-squat-clean` | dumbbell | 2 | full-body/olympic-style | intermediate | high | low | no | reps | From the hang, pull the dumbbells to the shoulders and ride the receive into a full squat. [src](https://www.crossfit.com/essentials/the-dumbbell-hang-clean) |
| Single-Arm Dumbbell Hang Power Clean | `db-single-arm-hang-power-clean` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | Hold one dumbbell at the hang, jump and shrug, and receive it on the same shoulder in a partial squat. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Hang Clean-to-Overhead | `db-hang-clean-to-overhead` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | Clean one dumbbell from the hang to the shoulder and get it overhead by any method (press, push press, or jerk). [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Clean and Jerk | `db-clean-and-jerk` | dumbbell | 2 | full-body/olympic-style | intermediate | high | low | no | reps | Clean two dumbbells from the floor to the shoulders, then dip and drive to jerk them to locked-out arms overhead. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Single-Arm Dumbbell Clean and Jerk | `db-single-arm-clean-and-jerk` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | Clean one dumbbell from the floor to the shoulder, then jerk it overhead to a locked-out arm. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Hang Clean and Press | `db-hang-clean-and-press` | dumbbell | 2 | full-body/olympic-style | intermediate | moderate | low | no | reps | Hang power clean two dumbbells to the shoulders, then strict press them overhead without leg drive. [src](https://www.acefitness.org/resources/everyone/exercise-library/383/clean-and-press/) |
| Dumbbell Power Snatch | `db-power-snatch` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | Pull one dumbbell from the floor with an explosive hip extension and punch it overhead in one motion, receiving in a partial squat. [src](https://www.crossfit.com/essentials/the-dumbbell-power-snatch) |
| Dumbbell Hang Power Snatch | `db-hang-power-snatch` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | From the hang at mid-thigh, jump and pull one dumbbell straight overhead, receiving in a partial squat. [src](https://barbend.com/dumbbell-snatch/) |
| Dumbbell Squat Snatch | `db-squat-snatch` | dumbbell | 1 | full-body/olympic-style | advanced | high | low | no | reps | Snatch one dumbbell from the floor and receive it locked out overhead in a full overhead squat. [src](https://www.crossfit.com/essentials/the-dumbbell-snatch) |
| Dumbbell Muscle Snatch | `db-muscle-snatch` | dumbbell | 1 | full-body/olympic-style | beginner | moderate | low | no | reps | Extend the hips and pull the dumbbell up the body with a high elbow, then turn it over to lockout without rebending the knees. [src](https://www.crossfit.com/essentials/the-dumbbell-power-snatch) |
| Alternating Dumbbell Snatch | `db-alternating-snatch` | dumbbell | 1 | full-body/olympic-style | intermediate | high | low | no | reps | Perform dumbbell power snatches, switching hands at the bottom or top of every rep. [src](https://www.crossfit.com/essentials/the-dumbbell-snatch) |
| Double Dumbbell Snatch | `double-db-snatch` | dumbbell | 2 | full-body/olympic-style | advanced | high | low | no | reps | Swing or pull two dumbbells from the floor and extend explosively to punch both overhead in one motion. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Single-Arm Dumbbell High Pull | `db-single-arm-high-pull` | dumbbell | 1 | vertical pull | intermediate | high | low | no | reps | From the hang, extend the hips explosively and pull one dumbbell to shoulder height with the elbow high and outside. [src](https://www.crossfit.com/essentials/the-dumbbell-power-snatch) |
| Dumbbell Thruster | `db-thruster` | dumbbell | 2 | squat | intermediate | high | low | no | reps | Front squat with dumbbells on the shoulders and use the drive out of the bottom to press them overhead in one fluid motion. [src](https://www.crossfit.com/essentials/the-dumbbell-thruster) |
| Single-Arm Dumbbell Thruster | `db-single-arm-thruster` | dumbbell | 1 | squat | intermediate | high | low | no | reps | Hold one dumbbell at the shoulder, squat, and drive up to press it overhead in one motion. [src](https://barbend.com/dumbbell-thruster/) |
| Dumbbell Cluster | `db-cluster` | dumbbell | 2 | full-body/olympic-style | advanced | high | low | no | reps | Squat clean two dumbbells from the floor and immediately drive out of the squat into a thruster. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Front Squat | `db-front-squat` | dumbbell | 2 | squat | beginner | moderate | low | no | reps | With dumbbells resting on the shoulders and elbows up, squat below parallel and stand to full hip extension. [src](https://www.crossfit.com/essentials/the-dumbbell-front-squat) |
| Goblet Squat | `goblet-squat` | dumbbell | 1 | squat | beginner | moderate | low | no | reps | Hold one dumbbell vertically at the chest and squat between the knees with the torso upright. [src](https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/) |
| Dumbbell Hang Squat | `db-hang-squat` | dumbbell | 2 | squat | beginner | moderate | low | no | reps | Hold dumbbells at the sides with straight arms and squat to depth, keeping the chest tall. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Sumo Squat | `db-sumo-squat` | dumbbell | 1 | squat | beginner | moderate | low | no | reps | Take a wide, toes-out stance and squat with one dumbbell hanging between the legs, driving the knees out. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/dumbbells/) |
| Single-Arm Dumbbell Overhead Squat | `db-overhead-squat` | dumbbell | 1 | squat | advanced | moderate | low | no | reps | Lock one dumbbell overhead with an active shoulder and squat to full depth while keeping it stacked over the mid-foot. [src](https://www.crossfit.com/essentials/the-dumbbell-overhead-squat) |
| Dumbbell Calf Raise | `db-calf-raise` | dumbbell | 2 | squat | beginner | low | low | no | reps | Hold dumbbells at the sides and rise onto the balls of the feet as high as possible, then lower slowly. [src](https://www.acefitness.org/resources/everyone/exercise-library/51/calf-raises/) |
| Dumbbell Cossack Squat | `db-cossack-squat` | dumbbell | 1 | lunge | intermediate | moderate | low | no | reps | From a wide stance with a goblet-held dumbbell, sit deep into one hip while the opposite leg straightens with toes up. [src](https://barbend.com/cossack-squat/) |
| Dumbbell Front-Rack Lunge | `db-front-rack-lunge` | dumbbell | 2 | lunge | intermediate | moderate | low | no | reps | With dumbbells on the shoulders, step forward and lower the back knee to touch the ground, then stand to full extension. [src](https://www.crossfit.com/essentials/the-dumbbell-front-rack-lunge) |
| Dumbbell Walking Lunge | `db-walking-lunge` | dumbbell | 2 | lunge | beginner | moderate | low | no | reps | Hold dumbbells at the sides and walk forward in alternating lunges, touching the back knee down each step. [src](https://www.acefitness.org/resources/everyone/exercise-library/363/lunge/) |
| Dumbbell Overhead Walking Lunge | `db-overhead-walking-lunge` | dumbbell | 1 | lunge | advanced | moderate | low | no | reps | Lock one dumbbell overhead and perform walking lunges while keeping the arm vertical and the torso upright. [src](https://www.crossfit.com/essentials/dumbbell-overhead-walking-lunge) |
| Dumbbell Reverse Lunge | `db-reverse-lunge` | dumbbell | 2 | lunge | beginner | moderate | low | no | reps | Step one foot back and lower the back knee toward the floor while holding dumbbells, then drive through the front heel to return. [src](https://www.acefitness.org/resources/everyone/exercise-library/319/reverse-lunge/) |
| Dumbbell Reverse Lunge to Press | `db-lunge-and-press` | dumbbell | 2 | lunge | intermediate | moderate | low | no | reps | Perform a reverse lunge with dumbbells at the shoulders and press them overhead as you return to standing. [src](https://www.acefitness.org/resources/everyone/exercise-library/143/lunge-with-overhead-press/) |
| Dumbbell Split Squat | `db-split-squat` | dumbbell | 2 | lunge | beginner | moderate | low | no | reps | From a fixed split stance holding dumbbells, lower straight down until the back knee nearly touches, then stand. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/dumbbells/) |
| Dumbbell Bulgarian Split Squat | `db-bulgarian-split-squat` | dumbbell, bench | 2 | lunge | intermediate | moderate | low | no | reps | With the rear foot on a bench or couch, lower into a split squat holding dumbbells, keeping the front knee tracking over the toes. [src](https://barbend.com/bulgarian-split-squat/) |
| Dumbbell Lateral Lunge | `db-lateral-lunge` | dumbbell | 1 | lunge | beginner | moderate | low | no | reps | Holding a dumbbell at the chest, step wide to one side and sit the hips back over that foot, keeping the other leg straight. [src](https://www.acefitness.org/resources/everyone/exercise-library/364/lateral-lunge/) |
| Dumbbell Curtsy Lunge | `db-curtsy-lunge` | dumbbell | 2 | lunge | intermediate | moderate | low | no | reps | Step one leg diagonally behind the other and lower into a lunge while holding dumbbells, then return. [src](https://barbend.com/curtsy-lunge/) |
| Dumbbell Step-Up | `db-step-up` | dumbbell, box | 2 | lunge | beginner | moderate | low | no | reps | Holding dumbbells, step onto a box or sturdy bench with one foot and stand fully on top before stepping down. [src](https://www.crossfit.com/essentials/the-box-step-up) |
| Dumbbell Box Step-Over | `db-box-step-over` | dumbbell, box | 2 | lunge | intermediate | high | low | no | reps | Carry dumbbells up onto a box and step down the other side, alternating direction each rep. [src](https://www.crossfit.com/essentials/the-box-step-up) |
| Dumbbell Strict Press | `db-strict-press` | dumbbell | 2 | vertical push | beginner | moderate | low | no | reps | From the shoulders, press both dumbbells straight overhead to lockout without using the legs. [src](https://www.acefitness.org/resources/everyone/exercise-library/71/standing-shoulder-press/) |
| Single-Arm Dumbbell Strict Press | `db-single-arm-strict-press` | dumbbell | 1 | vertical push | beginner | moderate | low | no | reps | Press one dumbbell from the shoulder to lockout overhead while bracing to keep the torso from leaning. [src](https://www.acefitness.org/resources/everyone/exercise-library/395/single-arm-overhead-press/) |
| Dumbbell Push Press | `db-push-press` | dumbbell | 2 | vertical push | intermediate | high | low | no | reps | Dip slightly at the knees and drive through the legs to propel the dumbbells overhead, finishing with a press to lockout. [src](https://www.crossfit.com/essentials/the-dumbbell-push-press) |
| Single-Arm Dumbbell Push Press | `db-single-arm-push-press` | dumbbell | 1 | vertical push | intermediate | moderate | low | no | reps | Dip and drive with the legs to push one dumbbell from the shoulder to lockout overhead. [src](https://www.crossfit.com/essentials/the-dumbbell-push-press) |
| Dumbbell Push Jerk | `db-push-jerk` | dumbbell | 2 | vertical push | intermediate | high | low | no | reps | Dip and drive the dumbbells upward, then re-bend the knees to catch them locked out overhead before standing. [src](https://www.crossfit.com/essentials/the-dumbbell-push-jerk) |
| Single-Arm Dumbbell Split Jerk | `db-split-jerk` | dumbbell | 1 | vertical push | advanced | high | low | no | reps | Dip and drive one dumbbell overhead while splitting the feet front and back to receive, then recover the feet together. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Arnold Press | `db-arnold-press` | dumbbell | 2 | vertical push | beginner | moderate | low | no | reps | Start with palms facing you at chin height and rotate the palms forward while pressing the dumbbells overhead. [src](https://barbend.com/arnold-press/) |
| Dumbbell Z Press | `db-z-press` | dumbbell | 2 | vertical push | intermediate | moderate | low | no | reps | Sit on the floor with legs straight out and press dumbbells overhead without leaning back. [src](https://barbend.com/z-press/) |
| Dumbbell Lateral Raise | `db-lateral-raise` | dumbbell | 2 | vertical push | beginner | low | low | no | reps | Raise light dumbbells out to the sides to shoulder height with slightly bent elbows, then lower slowly. [src](https://www.acefitness.org/resources/everyone/exercise-library/26/lateral-raise/) |
| Dumbbell Front Raise | `db-front-raise` | dumbbell | 2 | vertical push | beginner | low | low | no | reps | Raise dumbbells straight in front to shoulder height with nearly straight arms, then lower under control. [src](https://www.acefitness.org/resources/everyone/exercise-library/54/front-raise/) |
| Dumbbell Overhead Triceps Extension | `db-overhead-triceps-extension` | dumbbell | 1 | vertical push | beginner | low | low | no | reps | Hold one dumbbell overhead with both hands, lower it behind the head by bending the elbows, then extend. [src](https://www.acefitness.org/resources/everyone/exercise-library/74/triceps-extension/) |
| Dumbbell Floor Press | `db-floor-press` | dumbbell | 2 | horizontal push | beginner | moderate | low | no | reps | Lie on the floor with knees bent and press dumbbells from elbows-on-floor to lockout over the chest. [src](https://barbend.com/floor-press/) |
| Dumbbell Bench Press | `db-bench-press` | dumbbell, bench | 2 | horizontal push | beginner | moderate | low | no | reps | Lie on a bench and press dumbbells from chest level to lockout over the shoulders, lowering under control. [src](https://www.acefitness.org/resources/everyone/exercise-library/19/chest-press/) |
| Single-Arm Dumbbell Bench Press | `db-single-arm-bench-press` | dumbbell, bench | 1 | horizontal push | intermediate | moderate | low | no | reps | Press one dumbbell on a bench while bracing the core to keep from rotating off the bench. [src](https://www.acefitness.org/resources/everyone/exercise-library/356/offset-single-arm-chest-press/) |
| Dumbbell Incline Bench Press | `db-incline-bench-press` | dumbbell, adjustable_bench | 2 | horizontal push | beginner | moderate | low | no | reps | On an inclined bench, press dumbbells from upper chest to lockout above the shoulders. [src](https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/) |
| Dumbbell Floor Fly | `db-floor-fly` | dumbbell | 2 | horizontal push | beginner | low | low | no | reps | Lying on the floor with arms slightly bent, open the dumbbells out wide until the upper arms touch the floor, then hug them back together. [src](https://www.acefitness.org/resources/everyone/exercise-library/21/lying-chest-fly/) |
| Dumbbell Skull Crusher | `db-skull-crusher` | dumbbell | 2 | horizontal push | beginner | low | low | no | reps | Lying on the floor or a bench, lower the dumbbells toward the temples by bending only the elbows, then extend. [src](https://barbend.com/best-dumbbell-exercises/) |
| Dumbbell Bent-Over Row | `db-bent-over-row` | dumbbell | 2 | horizontal pull | beginner | moderate | low | no | reps | Hinge to about 45 degrees with a flat back and row both dumbbells to the lower ribs, then lower under control. [src](https://www.acefitness.org/resources/everyone/exercise-library/12/bent-over-row/) |
| Single-Arm Dumbbell Row | `db-single-arm-row` | dumbbell | 1 | horizontal pull | beginner | moderate | low | no | reps | Brace a hand on a knee or bench in a staggered hinge and row one dumbbell toward the hip. [src](https://barbend.com/dumbbell-row/) |
| Dumbbell Gorilla Row | `db-gorilla-row` | dumbbell | 2 | horizontal pull | intermediate | moderate | low | no | reps | From a wide, deep hinge with dumbbells on the floor, alternately row one dumbbell while the other stays planted. [src](https://barbend.com/best-dumbbell-exercises/) |
| Dumbbell Renegade Row | `renegade-row` | dumbbell | 2 | horizontal pull | intermediate | moderate | low | no | reps | In a high plank on two dumbbells with feet wide, row one dumbbell to the hip while resisting rotation, then alternate. [src](https://barbend.com/renegade-row/) |
| Dumbbell Reverse Fly | `db-reverse-fly` | dumbbell | 2 | horizontal pull | beginner | low | low | no | reps | Hinge forward and raise light dumbbells out to the sides with slightly bent arms, squeezing the shoulder blades. [src](https://www.acefitness.org/resources/everyone/exercise-library/353/reverse-fly/) |
| Dumbbell Biceps Curl | `db-biceps-curl` | dumbbell | 2 | horizontal pull | beginner | low | low | no | reps | With elbows pinned at the sides, curl the dumbbells up to the shoulders and lower slowly. [src](https://www.acefitness.org/resources/everyone/exercise-library/70/bicep-curl/) |
| Dumbbell Hammer Curl | `db-hammer-curl` | dumbbell | 2 | horizontal pull | beginner | low | low | no | reps | Curl the dumbbells with palms facing each other, keeping the elbows still. [src](https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/) |
| Dumbbell Upright Row | `db-upright-row` | dumbbell | 2 | vertical pull | beginner | low | low | no | reps | Pull dumbbells up along the front of the body to chest height, leading with the elbows. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/dumbbells/) |
| Dumbbell Pullover | `db-pullover` | dumbbell | 1 | vertical pull | beginner | low | low | no | reps | Lying on the floor or a bench with one dumbbell held overhead in both hands, lower it behind the head with long arms, then pull it back over the chest. [src](https://barbend.com/dumbbell-pullover/) |
| Dumbbell Shrug | `db-shrug` | dumbbell | 2 | carry | beginner | low | low | no | reps | Hold heavy dumbbells at the sides and elevate the shoulders straight up toward the ears, pause, and lower. [src](https://www.acefitness.org/resources/everyone/exercise-library/72/shrug/) |
| Dumbbell Farmers Carry | `db-farmers-carry` | dumbbell | 2 | carry | beginner | moderate | low | no | distance | Pick up a heavy dumbbell in each hand and walk tall with braced core and short, quick steps. [src](https://www.crossfit.com/essentials/the-farmer-carry) |
| Dumbbell Suitcase Carry | `db-suitcase-carry` | dumbbell | 1 | carry | beginner | moderate | low | no | distance | Carry one dumbbell at one side and walk without leaning or letting the torso shift. [src](https://www.acefitness.org/resources/everyone/exercise-library/358/suitcase-carry/) |
| Dumbbell Front-Rack Carry | `db-front-rack-carry` | dumbbell | 2 | carry | intermediate | moderate | low | no | distance | Hold dumbbells on the shoulders with elbows up and walk while keeping the ribcage down. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Overhead Carry | `db-overhead-carry` | dumbbell | 1 | carry | intermediate | moderate | low | no | distance | Lock one dumbbell overhead with a stacked, active shoulder and walk without letting the arm drift forward. [src](https://spmembersonly.com/pp-movement-library) |
| Double Dumbbell Overhead Carry | `double-db-overhead-carry` | dumbbell | 2 | carry | advanced | moderate | low | no | distance | Lock out two dumbbells overhead and walk with ribs down and biceps by the ears. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Turkish Get-Up | `db-turkish-get-up` | dumbbell | 1 | core/midline | advanced | moderate | low | no | reps | From lying with one dumbbell locked out overhead, move step by step to standing and back down while keeping the arm vertical. [src](https://www.crossfit.com/essentials/the-dumbbell-turkish-get-up) |
| Dumbbell Half Turkish Get-Up | `db-half-turkish-get-up` | dumbbell | 1 | core/midline | intermediate | low | low | no | reps | From lying with a dumbbell locked out overhead, roll to the elbow, then the hand, then bridge the hips before reversing. [src](https://www.acefitness.org/resources/everyone/exercise-library/381/half-turkish-get-up/) |
| Dumbbell Windmill | `db-windmill` | dumbbell | 1 | rotation | intermediate | low | low | no | reps | With one dumbbell locked out overhead and feet angled, hinge sideways to reach the free hand toward the floor while eyes stay on the dumbbell. [src](https://www.acefitness.org/resources/everyone/exercise-library/386/high-windmill/) |
| Dumbbell Man Maker | `db-man-maker` | dumbbell | 2 | full-body/olympic-style | advanced | high | high | no | reps | On two dumbbells perform a push-up and a row on each side, jump the feet in, clean the dumbbells, and thruster them overhead. [src](https://fitness.mtntactical.com/exercises/details.php?id=renegade-man-maker) |
| Devil Press | `devil-press` | dumbbell | 2 | full-body/olympic-style | advanced | high | high | no | reps | Perform a burpee with hands on two dumbbells, then hinge and swing both dumbbells from the floor to overhead in one motion. [src](https://barbend.com/devils-press/) |
| Dumbbell Burpee Deadlift | `db-burpee-deadlift` | dumbbell | 2 | full-body/olympic-style | intermediate | high | high | no | reps | With hands on two dumbbells, jump the feet back to a push-up and in again, then deadlift the dumbbells to standing. [src](https://barbend.com/burpee-variations/) |
| Burpee Over Dumbbell | `db-burpee-hop-over` | dumbbell | 1 | full-body/olympic-style | beginner | high | high | yes | reps | Perform a burpee beside a dumbbell lying on its side, then jump laterally over it with both feet. [src](https://spmembersonly.com/no-equipment) |
| Dumbbell Russian Twist | `db-russian-twist` | dumbbell | 1 | rotation | beginner | moderate | low | no | reps | Sit leaning back with heels light and rotate a dumbbell from hip to hip. [src](https://www.acefitness.org/resources/everyone/exercise-library/65/russian-twist/) |
| Dumbbell Woodchop | `db-woodchop` | dumbbell | 1 | rotation | beginner | moderate | low | no | reps | Hold one dumbbell with both hands and swing it diagonally from above one shoulder to outside the opposite knee, pivoting the feet. [src](https://www.acefitness.org/resources/everyone/exercise-library/347/lateral-lunge-wood-chop/) |
| Dumbbell Halo | `db-halo` | dumbbell | 1 | core/midline | beginner | low | low | no | reps | Hold one dumbbell by the horns at the chest and circle it around the head close to the neck, alternating directions. [src](https://www.acefitness.org/resources/everyone/exercise-library/394/halo/) |
| Dumbbell Sit-Up | `db-weighted-sit-up` | dumbbell | 1 | core/midline | intermediate | moderate | low | no | reps | Holding one dumbbell at the chest or locked out overhead, perform a full sit-up from lying to upright. [src](https://www.crossfit.com/essentials/the-abmat-sit-up) |
| Dumbbell V-Up | `db-weighted-v-up` | dumbbell | 1 | core/midline | advanced | moderate | low | no | reps | Holding a light dumbbell in both hands overhead, lift the arms and legs together to meet over the hips. [src](https://barbend.com/best-dumbbell-exercises/) |
| Dumbbell Plank Pull-Through | `db-plank-pull-through` | dumbbell | 1 | core/midline | intermediate | low | low | no | reps | In a high plank, reach under the body with one hand and drag a dumbbell to the opposite side without rocking the hips. [src](https://barbend.com/best-dumbbell-exercises/) |

### bodyweight (83)

| Name | id | Equipment | DBs | Pattern | Skill | Intensity | Impact | Vest | Unit | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Air Squat | `air-squat` | none | 0 | squat | beginner | moderate | low | yes | reps | With feet shoulder-width, push the hips back and down until the hip crease is below the knees, then stand to full extension. [src](https://www.crossfit.com/essentials/the-air-squat) |
| Squat to Target | `squat-to-target` | bench | 0 | squat | beginner | low | low | yes | reps | Squat down until the hips lightly touch a chair, low box, or bench, then stand; used to scale depth. [src](https://spmembersonly.com/pp-movement-library) |
| Pause Air Squat | `pause-squat` | none | 0 | squat | beginner | moderate | low | yes | reps | Perform an air squat and hold the bottom position for a set count before standing. [src](https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/) |
| Cossack Squat | `cossack-squat` | none | 0 | lunge | intermediate | low | low | yes | reps | From a wide stance, shift deep into one bent leg while the other leg stays straight with toes pointing up. [src](https://barbend.com/cossack-squat/) |
| Pistol Squat | `pistol` | none | 0 | squat | advanced | moderate | low | no | reps | Squat on one leg to full depth with the other leg held straight in front, then stand without touching down. [src](https://www.crossfit.com/essentials/the-single-leg-squat) |
| Shrimp Squat | `shrimp-squat` | none | 0 | squat | advanced | moderate | low | no | reps | Holding the back foot behind you, lower on one leg until the rear knee touches the ground, then stand. [src](https://www.acefitness.org/resources/everyone/exercise-library/136/single-leg-squat/) |
| Wall Sit | `wall-sit` | wall | 0 | squat | beginner | moderate | low | yes | time | Lean back against a wall with knees bent about 90 degrees and hold the position. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Forward Lunge | `forward-lunge` | none | 0 | lunge | beginner | moderate | low | yes | reps | Step forward and lower until the back knee touches the floor, then push back to the start. [src](https://www.acefitness.org/resources/everyone/exercise-library/8/forward-lunge/) |
| Reverse Lunge | `reverse-lunge` | none | 0 | lunge | beginner | moderate | low | yes | reps | Step one foot back and lower the back knee to the floor, then drive through the front foot to stand. [src](https://www.acefitness.org/resources/everyone/exercise-library/319/reverse-lunge/) |
| Walking Lunge | `walking-lunge` | none | 0 | lunge | beginner | moderate | low | yes | distance | Lunge forward continuously, touching the back knee down each step and standing to full hip extension. [src](https://www.crossfit.com/essentials/the-walking-lunge) |
| Split Squat | `split-squat` | none | 0 | lunge | beginner | low | low | yes | reps | In a fixed split stance, lower straight down until the back knee nearly touches and rise. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Bodyweight Bulgarian Split Squat | `bulgarian-split-squat` | bench | 0 | lunge | intermediate | moderate | low | yes | reps | With the rear foot on a bench or couch, lower into a deep split squat and drive up through the front foot. [src](https://www.acefitness.org/resources/everyone/exercise-library/366/bulgarian-split-squat/) |
| Lateral Lunge | `lateral-lunge` | none | 0 | lunge | beginner | low | low | yes | reps | Step wide to one side, sit back into that hip with the other leg straight, then push back to center. [src](https://www.acefitness.org/resources/everyone/exercise-library/50/side-lunge/) |
| Curtsy Lunge | `curtsy-lunge` | none | 0 | lunge | beginner | low | low | yes | reps | Step one leg diagonally behind the other and lower into a lunge, then return. [src](https://barbend.com/curtsy-lunge/) |
| Transverse Lunge | `transverse-lunge` | none | 0 | lunge | intermediate | low | low | yes | reps | Pivot and step one foot back at a 135-degree angle into a lunge, then return to the start. [src](https://www.acefitness.org/resources/everyone/exercise-library/365/transverse-lunge/) |
| Step-Up | `step-up` | box | 0 | lunge | beginner | moderate | low | yes | reps | Step onto a stable box, bench, or stair with one foot and stand fully before stepping down. [src](https://www.acefitness.org/resources/everyone/exercise-library/28/step-up/) |
| Glute Bridge | `glute-bridge` | none | 0 | hinge | beginner | low | low | yes | reps | Lie on your back with knees bent and drive the hips up until shoulders, hips, and knees align. [src](https://www.acefitness.org/resources/everyone/exercise-library/49/glute-bridge/) |
| Glute Bridge March | `glute-bridge-march` | none | 0 | hinge | beginner | low | low | yes | reps | Hold a glute bridge and alternately lift each foot a few inches off the floor without the hips dropping. [src](https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/) |
| Single-Leg Glute Bridge | `single-leg-glute-bridge` | none | 0 | hinge | intermediate | low | low | yes | reps | Perform a glute bridge driving through one foot with the other leg extended. [src](https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/) |
| Bodyweight Single-Leg RDL | `bodyweight-single-leg-rdl` | none | 0 | hinge | beginner | low | low | yes | reps | Balance on one leg and hinge forward with a flat back while the free leg reaches behind, then return. [src](https://www.acefitness.org/resources/everyone/exercise-library/127/single-arm-single-leg-romanian-dead-lift/) |
| Superman | `superman` | none | 0 | hinge | beginner | low | low | no | reps | Lying face down, lift arms, chest, and legs off the floor together, pause, and lower. [src](https://www.acefitness.org/resources/everyone/exercise-library/9/supermans/) |
| Arch Rock | `arch-rock` | none | 0 | core/midline | intermediate | low | low | no | reps | Hold a superman arch and rock forward and back from chest to thighs without losing the shape. [src](https://barbend.com/hollow-hold/) |
| Calf Raise | `calf-raise` | none | 0 | squat | beginner | low | low | yes | reps | Rise onto the balls of the feet as high as possible, pause, and lower slowly. [src](https://www.acefitness.org/resources/everyone/exercise-library/73/standing-calf-raises-wall/) |
| Single-Leg Calf Raise | `single-leg-calf-raise` | none | 0 | squat | beginner | low | low | yes | reps | Balance on one foot, using a wall lightly for balance, and perform full-range calf raises. [src](https://www.acefitness.org/resources/everyone/exercise-library/51/calf-raises/) |
| Push-Up | `push-up` | none | 0 | horizontal push | beginner | moderate | low | yes | reps | From a rigid plank, lower the chest to the floor with elbows angled back, then press to lockout. [src](https://www.crossfit.com/essentials/the-push-up) |
| Bent-Knee Push-Up | `knee-push-up` | none | 0 | horizontal push | beginner | low | low | no | reps | Perform a push-up from the knees, keeping a straight line from knees to head. [src](https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/) |
| Incline Push-Up | `incline-push-up` | bench | 0 | horizontal push | beginner | low | low | yes | reps | Place hands on a bench, box, or countertop and perform push-ups with a rigid body. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Decline Push-Up | `decline-push-up` | bench | 0 | horizontal push | intermediate | moderate | low | yes | reps | With feet elevated on a bench or step, lower the chest to the floor and press up. [src](https://barbend.com/push-up-variations/) |
| Hand-Release Push-Up | `hand-release-push-up` | none | 0 | horizontal push | beginner | moderate | low | yes | reps | Lower all the way to the floor, lift the hands briefly, then replace them and press back to plank. [src](https://www.crossfit.com/essentials/the-push-up) |
| Diamond Push-Up | `diamond-push-up` | none | 0 | horizontal push | intermediate | moderate | low | yes | reps | Place the hands together under the chest with thumbs and index fingers forming a diamond and perform push-ups. [src](https://barbend.com/push-up-variations/) |
| Wide-Grip Push-Up | `wide-push-up` | none | 0 | horizontal push | beginner | moderate | low | yes | reps | Perform push-ups with the hands set wider than shoulder-width. [src](https://barbend.com/push-up-variations/) |
| Staggered-Hand Push-Up | `staggered-push-up` | none | 0 | horizontal push | intermediate | moderate | low | yes | reps | Perform push-ups with one hand set forward and the other back, switching each set. [src](https://www.acefitness.org/resources/everyone/exercise-library/327/push-up-with-staggered-hands/) |
| Archer Push-Up | `archer-push-up` | none | 0 | horizontal push | advanced | moderate | low | no | reps | From a very wide hand position, lower toward one hand while the other arm straightens out to the side. [src](https://barbend.com/push-up-variations/) |
| Spiderman Push-Up | `spiderman-push-up` | none | 0 | horizontal push | intermediate | moderate | low | yes | reps | As you lower into a push-up, bring one knee to the same-side elbow, alternating each rep. [src](https://barbend.com/push-up-variations/) |
| Hindu Push-Up | `hindu-push-up` | none | 0 | horizontal push | intermediate | moderate | low | no | reps | From a downward-dog position, swoop the chest low between the hands and up into a cobra, then push back. [src](https://barbend.com/push-up-variations/) |
| Push-Up + Shoulder Taps | `push-up-plus-shoulder-taps` | none | 0 | horizontal push | intermediate | moderate | low | yes | reps | Perform a push-up, then tap each shoulder with the opposite hand while holding plank. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Pike Push-Up | `pike-push-up` | none | 0 | vertical push | intermediate | moderate | low | no | reps | With hips piked high, bend the elbows to lower the head toward the floor in front of the hands, then press up. [src](https://www.crossfit.com/essentials/handstand-push-up-variations) |
| Handstand Push-Up (Wall) | `wall-handstand-push-up` | wall | 0 | vertical push | advanced | high | low | no | reps | Kick up to a handstand against a wall, lower the head to the floor, and press to lockout. [src](https://www.crossfit.com/essentials/the-strict-handstand-push-up) |
| Kipping Handstand Push-Up | `kipping-handstand-push-up` | wall | 0 | vertical push | advanced | high | low | no | reps | From head-down in a wall handstand, tuck the knees and kick the legs up while pressing to lockout. [src](https://www.crossfit.com/essentials/the-kipping-handstand-push-up) |
| Wall Walk | `wall-walk` | wall | 0 | vertical push | intermediate | high | low | no | reps | From a push-up position with feet at the wall, walk the feet up and hands in until chest touches the wall, then walk back down. [src](https://www.crossfit.com/essentials/the-wall-walk) |
| Wall-Facing Handstand Hold | `handstand-hold` | wall | 0 | vertical push | intermediate | moderate | low | no | time | Walk the feet up a wall until the body is nearly vertical with chest facing the wall, and hold with a hollow body. [src](https://www.crossfit.com/essentials/freestanding-handstand) |
| Handstand Walk | `handstand-walk` | none | 0 | locomotion | advanced | high | low | no | distance | Kick up to a freestanding handstand and walk forward on the hands while keeping balance. [src](https://www.crossfit.com/essentials/the-handstand-walk) |
| Bench Dip | `bench-dip` | bench | 0 | vertical push | beginner | moderate | low | no | reps | With hands on the edge of a bench or chair behind you, lower the hips by bending the elbows to about 90 degrees, then press up. [src](https://www.crossfit.com/essentials/the-dip) |
| Front Plank | `plank` | none | 0 | core/midline | beginner | low | low | yes | time | Hold a straight line from head to heels on forearms or hands with glutes and abs braced. [src](https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/) |
| Plank Shoulder Tap | `plank-shoulder-tap` | none | 0 | core/midline | beginner | low | low | yes | reps | In a high plank with feet wide, tap one shoulder with the opposite hand without rocking the hips. [src](https://spmembersonly.com/pp-movement-library) |
| Plank Up-Down | `plank-up-down` | none | 0 | core/midline | beginner | moderate | low | yes | reps | Move from a forearm plank to a high plank one arm at a time and back down, alternating the lead arm. [src](https://www.acefitness.org/resources/everyone/exercise-library/320/plank-ups/) |
| Side Plank | `side-plank` | none | 0 | core/midline | beginner | low | low | yes | time | Support the body on one forearm and the side of the feet, keeping hips lifted in a straight line. [src](https://www.acefitness.org/resources/everyone/exercise-library/303/side-plank/) |
| Modified Side Plank | `side-plank-modified` | none | 0 | core/midline | beginner | low | low | no | time | Perform a side plank with the knees bent and supported on the floor. [src](https://www.acefitness.org/resources/everyone/exercise-library/100/side-plank-modified/) |
| Side Plank Hip Dip | `side-plank-hip-dip` | none | 0 | core/midline | intermediate | low | low | yes | reps | From a side plank, lower the hip toward the floor and lift it back up for reps. [src](https://www.acefitness.org/resources/everyone/exercise-library/303/side-plank/) |
| Hollow Hold | `hollow-hold` | none | 0 | core/midline | beginner | low | low | no | time | Lying on your back, press the low back into the floor and lift shoulders and straight legs, arms overhead, and hold. [src](https://barbend.com/hollow-hold/) |
| Hollow Rock | `hollow-rock` | none | 0 | core/midline | intermediate | moderate | low | no | reps | Hold the hollow position and rock from upper back to tailbone without breaking the shape. [src](https://barbend.com/hollow-hold/) |
| Dead Bug | `dead-bug` | none | 0 | core/midline | beginner | low | low | no | reps | On your back with arms up and knees over hips, slowly extend opposite arm and leg while keeping the low back flat. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Bird Dog | `bird-dog` | none | 0 | core/midline | beginner | low | low | no | reps | On hands and knees, extend the opposite arm and leg while keeping the hips level, then switch. [src](https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/) |
| Sit-Up | `sit-up` | none | 0 | core/midline | beginner | moderate | low | yes | reps | From lying with arms overhead, sit up until the shoulders pass over the hips and touch the floor beyond the feet; an AbMat is optional. [src](https://www.crossfit.com/essentials/the-abmat-sit-up) |
| Crunch | `crunch` | none | 0 | core/midline | beginner | low | low | no | reps | With knees bent, curl the shoulder blades off the floor toward the pelvis and lower slowly. [src](https://www.acefitness.org/resources/everyone/exercise-library/52/crunch/) |
| Reverse Crunch | `reverse-crunch` | none | 0 | core/midline | beginner | low | low | no | reps | Lying on your back, curl the knees toward the chest and lift the hips slightly off the floor, then lower. [src](https://www.acefitness.org/resources/everyone/exercise-library/76/reverse-crunch/) |
| Bicycle Crunch | `bicycle-crunch` | none | 0 | rotation | beginner | moderate | low | no | reps | Alternate touching elbow to opposite knee while extending the other leg in a pedaling motion. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| V-Up | `v-up` | none | 0 | core/midline | intermediate | moderate | low | no | reps | From lying fully extended, lift arms and straight legs simultaneously to meet over the hips. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Alternating V-Up | `alternating-v-up` | none | 0 | core/midline | beginner | moderate | low | no | reps | Lift one straight leg and both arms to touch the foot, alternating legs each rep. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Tuck-Up | `tuck-up` | none | 0 | core/midline | beginner | moderate | low | no | reps | From a hollow position, pull the knees and chest together into a tuck, then extend back out. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Lying Leg Raise | `lying-leg-raise` | none | 0 | core/midline | beginner | low | low | no | reps | Lying on your back, raise straight legs to vertical and lower slowly without arching the low back. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Flutter Kicks | `flutter-kick` | none | 0 | core/midline | beginner | moderate | low | yes | reps | In a shallow hollow position, alternate small, quick up-and-down kicks with straight legs. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Heel Taps | `heel-taps` | none | 0 | core/midline | beginner | low | low | yes | reps | With knees bent and shoulders lifted, crunch side to side to tap each heel with the same-side hand. [src](https://spmembersonly.com/pp-movement-library) |
| Russian Twist | `russian-twist` | none | 0 | rotation | beginner | moderate | low | yes | reps | Sit leaning back with feet light or lifted and rotate the hands from hip to hip. [src](https://www.acefitness.org/resources/everyone/exercise-library/65/russian-twist/) |
| Lying Windshield Wiper | `floor-windshield-wiper` | none | 0 | rotation | intermediate | low | low | no | reps | Lying on your back with legs vertical and arms out, lower the legs to one side and then the other under control. [src](https://www.crossfit.com/essentials/the-windshield-wiper) |
| L-Sit (Floor) | `floor-l-sit` | none | 0 | core/midline | advanced | moderate | low | no | time | Press the hands into the floor beside the hips and lift the hips and straight legs off the ground; scale with bent knees. [src](https://www.crossfit.com/essentials/the-l-sit) |
| Mountain Climber | `mountain-climber` | none | 0 | core/midline | beginner | high | low | yes | reps | In a high plank, drive the knees toward the chest one at a time in a running rhythm. [src](https://www.acefitness.org/resources/everyone/exercise-library/258/mountain-climbers/) |
| Cross-Body Mountain Climber | `cross-body-mountain-climber` | none | 0 | rotation | beginner | high | low | yes | reps | Perform mountain climbers driving each knee toward the opposite elbow. [src](https://barbend.com/mountain-climbers/) |
| Bear Hold | `bear-hold` | none | 0 | core/midline | beginner | low | low | yes | time | From hands and knees, lift the knees an inch off the ground and hold with a flat back. [src](https://spmembersonly.com/pp-movement-library) |
| Bear Crawl | `bear-crawl` | none | 0 | locomotion | beginner | moderate | low | yes | distance | On hands and toes with knees hovering just off the ground, crawl forward moving opposite hand and foot together. [src](https://barbend.com/bear-crawl/) |
| Lateral Bear Crawl | `lateral-bear-crawl` | none | 0 | locomotion | intermediate | moderate | low | yes | distance | Move sideways in a bear position, stepping hands and feet laterally without letting the hips rise. [src](https://www.acefitness.org/resources/everyone/exercise-library/328/lateral-crawls/) |
| Crab Walk | `crab-walk` | none | 0 | locomotion | beginner | moderate | low | no | distance | Sitting with hands behind and hips lifted, walk forward or backward on hands and feet. [src](https://www.acefitness.org/resources/everyone/exercise-library/247/spider-walks/) |
| Inchworm | `inchworm` | none | 0 | core/midline | beginner | low | low | no | reps | Hinge to place the hands on the floor, walk them out to a plank, then walk the feet up toward the hands. [src](https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/) |
| Burpee | `burpee` | none | 0 | full-body/olympic-style | beginner | high | high | yes | reps | Drop the chest to the floor, push up, jump the feet to the hands, and stand with a small jump and clap overhead. [src](https://www.crossfit.com/essentials/the-burpee-2) |
| Up-Down | `up-down` | none | 0 | full-body/olympic-style | beginner | moderate | low | yes | reps | Step back into plank, lower the chest, then step the feet in and stand without jumping. [src](https://www.acefitness.org/resources/everyone/exercise-library/306/burpee/) |
| Squat Thrust | `squat-thrust` | none | 0 | full-body/olympic-style | beginner | high | high | yes | reps | Squat to place hands on the floor, jump the feet back to plank, jump them back in, and stand. [src](https://barbend.com/best-plyometric-exercises/) |
| Sprawl | `sprawl` | none | 0 | full-body/olympic-style | intermediate | high | high | yes | reps | Quickly drop the hips to the floor with legs back and chest low, then pop back up to an athletic stance. [src](https://barbend.com/burpee-variations/) |
| Sit-Through | `sit-through` | none | 0 | rotation | intermediate | moderate | low | yes | reps | From a bear position, lift one hand and thread the opposite leg under the body to kick through, then return and switch. [src](https://barbend.com/burpee-variations/) |
| Walk | `walk` | none | 0 | locomotion | beginner | low | low | yes | distance | Walk briskly with an upright posture for distance or time; the low-impact substitute for running. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Run | `run` | none | 0 | locomotion | beginner | moderate | high | yes | distance | Run at a sustainable pace over a set distance or time. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Sprint | `sprint` | none | 0 | locomotion | intermediate | high | high | no | distance | Run at maximal effort for a short distance with full recovery between efforts. [src](https://barbend.com/best-plyometric-exercises/) |
| Shuttle Run | `shuttle-run` | none | 0 | locomotion | beginner | high | high | yes | distance | Run back and forth between two lines, touching the ground or line at each turn. [src](https://spmembersonly.com/no-equipment) |
| Lateral Shuffle | `lateral-shuffle` | none | 0 | locomotion | beginner | moderate | low | yes | distance | In an athletic stance, shuffle sideways quickly without crossing the feet. [src](https://www.acefitness.org/resources/everyone/exercise-library/181/lateral-shuffles/) |

### jump_rope (19)

| Name | id | Equipment | DBs | Pattern | Skill | Intensity | Impact | Vest | Unit | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Single-Under | `single-under` | jump_rope | 0 | jump | beginner | moderate | high | yes | reps | Jump with both feet just high enough for the rope to pass under once per jump, turning the rope from the wrists. [src](https://www.crossfit.com/essentials/the-single-under) |
| Double-Under | `double-under` | jump_rope | 0 | jump | intermediate | high | high | yes | reps | Jump slightly higher and spin the rope fast so it passes under the feet twice per jump. [src](https://www.crossfit.com/essentials/the-double-under) |
| Triple-Under | `triple-under` | jump_rope | 0 | jump | advanced | high | high | no | reps | Jump high with a tight hollow body and spin the rope three times under the feet per jump. [src](https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide) |
| Single-Leg Jump Rope Hop | `single-leg-single-under` | jump_rope | 0 | jump | intermediate | moderate | high | yes | reps | Jump rope hopping on one foot only, then switch feet after a set count or time. [src](https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide) |
| Single-Leg Double-Under | `single-leg-double-under` | jump_rope | 0 | jump | advanced | high | high | no | reps | Perform double-unders while hopping on one foot only. [src](https://www.crossrope.com/blogs/blog/how-to-do-double-unders/) |
| Jump Rope Boxer Step | `boxer-step` | jump_rope | 0 | jump | beginner | low | low | yes | time | Shift weight from one foot to the other every couple of rope turns with a light double tap, like a relaxed boxer. [src](https://doperopes.co.uk/pages/jump-rope-training-footwork-series) |
| Jump Rope Alternate-Foot Step | `alternate-foot-step` | jump_rope | 0 | jump | beginner | moderate | high | yes | time | Jog in place over the rope, alternating feet so one foot clears each turn. [src](https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide) |
| High-Knee Jump Rope | `high-knee-jump-rope` | jump_rope | 0 | jump | intermediate | high | high | yes | time | Run in place over the rope, driving each knee up to hip height. [src](https://www.jumpropedudes.com/blog/easy-jump-rope-tricks/) |
| Jump Rope Side Straddle | `jump-rope-side-straddle` | jump_rope | 0 | jump | beginner | moderate | high | yes | reps | Alternate landing with feet wide and feet together like a jumping jack while turning the rope. [src](https://doperopes.co.uk/pages/jump-rope-training-footwork-series) |
| Jump Rope Scissors | `jump-rope-scissors` | jump_rope | 0 | jump | beginner | moderate | high | yes | reps | Land each jump in a short split stance, switching which foot is forward every jump. [src](https://doperopes.co.uk/pages/jump-rope-training-footwork-series) |
| Jump Rope Skier | `jump-rope-skier` | jump_rope | 0 | jump | beginner | moderate | high | yes | reps | Hop with feet together a few inches side to side on each turn of the rope. [src](https://www.jumpropedudes.com/blog/easy-jump-rope-tricks/) |
| Jump Rope Bell | `jump-rope-bell` | jump_rope | 0 | jump | beginner | moderate | high | yes | reps | Hop with feet together a few inches forward and back on each turn of the rope. [src](https://www.jumpropedudes.com/blog/easy-jump-rope-tricks/) |
| Jump Rope Heel-Toe | `jump-rope-heel-toe` | jump_rope | 0 | jump | intermediate | low | high | no | reps | While hopping on one foot, tap the other heel forward, then its toe beside you, then switch. [src](https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide) |
| Jump Rope Criss-Cross | `criss-cross` | jump_rope | 0 | jump | intermediate | moderate | high | no | reps | On one jump cross the arms in front so the hands pass the hips, jump through the loop, then uncross on the next. [src](https://www.elevaterope.com/blogs/jump-rope-tricks-freestyle/jump-rope-trick-names-glossary) |
| Jump Rope Side Swing | `side-swing` | jump_rope | 0 | jump | beginner | low | low | no | reps | Bring both handles together and swing the rope beside the body, then open it to resume jumping. [src](https://www.elevaterope.com/blogs/jump-rope-tricks-freestyle/jump-rope-trick-names-glossary) |
| Double-Under Crossover | `crossover-double-under` | jump_rope | 0 | jump | advanced | high | high | no | reps | Perform a double-under in which the arms cross on the second rope pass and uncross on the next jump. [src](https://www.jumpropedudes.com/blog/easy-jump-rope-tricks/) |
| Backward Single-Under | `backward-single-under` | jump_rope | 0 | jump | intermediate | moderate | high | yes | reps | Turn the rope from front to back over the head and jump it as it passes under the heels. [src](https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide) |
| Double-Under Boxer Step | `double-under-boxer-step` | jump_rope | 0 | jump | advanced | high | high | no | reps | Perform double-unders while alternating weight foot to foot each jump. [src](https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide) |
| Penguin Jumps (no rope) | `penguin-jumps-move` | none | 0 | jump | beginner | moderate | high | yes | reps | Jump as high as for a double-under and tap the thighs twice with the hands before landing; a no-rope DU substitute. [src](https://www.crossrope.com/blogs/blog/how-to-do-double-unders/) |

### plyometric (42)

| Name | id | Equipment | DBs | Pattern | Skill | Intensity | Impact | Vest | Unit | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Squat Jump | `squat-jump` | none | 0 | jump | beginner | high | high | yes | reps | Squat to about parallel and explode straight up, landing softly back into the next squat. [src](https://barbend.com/best-plyometric-exercises/) |
| Dumbbell Squat Jump | `db-squat-jump` | dumbbell | 2 | jump | intermediate | high | high | no | reps | Holding light dumbbells at the sides, quarter- to half-squat and jump vertically, landing softly. [src](https://barbend.com/best-plyometric-exercises/) |
| Tuck Jump | `tuck-jump` | none | 0 | jump | intermediate | high | high | no | reps | Jump straight up and pull both knees toward the chest at the top before landing softly. [src](https://barbend.com/tuck-jumps/) |
| Jump and Reach | `jump-and-reach` | none | 0 | jump | beginner | high | high | yes | reps | Dip quickly and jump as high as possible, reaching both arms toward the ceiling, then land and reset. [src](https://www.acefitness.org/resources/everyone/exercise-library/176/jump-and-reach/) |
| Broad Jump | `broad-jump` | none | 0 | jump | intermediate | high | high | yes | reps | Swing the arms and jump forward as far as possible from two feet, sticking a balanced two-foot landing. [src](https://www.muscleandfitness.com/muscle-fitness-hers/hers-workouts/8-plyometrics-exercises-you-can-do-without-gym/) |
| Single-Leg Broad Jump | `single-leg-broad-jump` | none | 0 | jump | advanced | high | high | no | reps | Jump forward off one leg and land on the same leg, sticking the landing for a beat. [src](https://barbend.com/best-plyometric-exercises/) |
| Burpee Broad Jump | `burpee-broad-jump` | none | 0 | jump | intermediate | high | high | yes | distance | Perform a burpee and, instead of jumping vertically, broad jump forward to start the next rep. [src](https://barbend.com/burpee-variations/) |
| Lateral Burpee Over Line | `lateral-burpee-over-line` | none | 0 | jump | beginner | high | high | yes | reps | Perform a burpee parallel to a line or low object and jump laterally over it with both feet. [src](https://spmembersonly.com/no-equipment) |
| Lateral Step-Over | `lateral-step-over` | none | 0 | locomotion | beginner | low | low | yes | reps | Step laterally over a line or low object one foot at a time; the no-impact version of hop-overs. [src](https://spmembersonly.com/no-equipment) |
| Lateral Line Hop | `lateral-line-hop` | none | 0 | jump | beginner | moderate | high | yes | reps | Hop side to side over a line with both feet using quick, springy contacts; a common Street Parking jump rope substitute. [src](https://spmembersonly.com/no-equipment) |
| Lateral Jump Over Dumbbell | `lateral-hop-over-object` | dumbbell | 0 | jump | beginner | high | high | yes | reps | Jump laterally with both feet over a low object such as a dumbbell on its side, landing softly each time. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Forward-Backward Line Hop | `forward-back-line-hop` | none | 0 | jump | beginner | moderate | high | yes | reps | Hop forward and back over a line with feet together using quick, light contacts. [src](https://www.acefitness.org/resources/everyone/exercise-library/177/forward-linear-jumps/) |
| Skater Jump | `skater-jump` | none | 0 | jump | intermediate | high | high | yes | reps | Leap sideways from one leg to the other, landing softly and swinging the trailing leg behind. [src](https://www.muscleandfitness.com/muscle-fitness-hers/hers-workouts/8-plyometrics-exercises-you-can-do-without-gym/) |
| Lateral Bound | `lateral-bound` | none | 0 | jump | advanced | high | high | no | reps | Bound laterally for maximum distance from one leg and stick the landing on the opposite leg for a beat. [src](https://www.acefitness.org/resources/everyone/exercise-library/246/alternate-leg-push-off/) |
| Split Squat Jump | `split-squat-jump` | none | 0 | jump | intermediate | high | high | yes | reps | From a lunge, jump explosively and switch legs in the air to land in a lunge on the opposite side. [src](https://www.acefitness.org/resources/everyone/exercise-library/234/cycled-split-squat-jump/) |
| Pogo Hops | `pogo-hop` | none | 0 | jump | beginner | moderate | high | yes | reps | Bounce in place on the balls of the feet with stiff ankles and minimal knee bend, minimizing ground contact time. [src](https://barbend.com/best-plyometric-exercises/) |
| Single-Leg Pogo Hops | `single-leg-pogo` | none | 0 | jump | intermediate | moderate | high | yes | reps | Perform quick, stiff-ankle pogo hops on one foot. [src](https://barbend.com/best-plyometric-exercises/) |
| Single-Leg Hop to Stick | `single-leg-hop-to-stick` | none | 0 | jump | intermediate | moderate | high | no | reps | Hop forward on one leg and freeze the landing for 2-3 seconds with the knee tracking over the toes. [src](https://www.acefitness.org/resources/everyone/exercise-library/230/single-leg-push-off/) |
| Hexagon Drill | `hexagon-drill` | none | 0 | jump | intermediate | high | high | yes | reps | Facing one direction, hop out and back into the center of a taped hexagon, moving around each side in turn. [src](https://www.acefitness.org/resources/everyone/exercise-library/207/hexagon-drill/) |
| Lateral Over-Unders | `lateral-over-under` | none | 0 | jump | intermediate | high | high | yes | reps | Alternate hopping laterally over a low object and ducking under a higher one in a continuous side-to-side pattern. [src](https://www.acefitness.org/resources/everyone/exercise-library/206/lateral-over-unders/) |
| Frog Jump | `frog-jump` | none | 0 | jump | intermediate | high | high | no | reps | From a deep wide squat with hands touching the floor, jump forward and land back in the deep squat. [src](https://barbend.com/best-plyometric-exercises/) |
| 180-Degree Jump | `180-jump` | none | 0 | jump | intermediate | high | high | no | reps | Jump vertically and rotate 180 degrees in the air, landing softly facing the opposite direction. [src](https://barbend.com/best-plyometric-exercises/) |
| Bounding | `bounding` | none | 0 | locomotion | advanced | high | high | no | distance | Run with exaggerated, powerful strides, pushing off each leg for maximum horizontal distance and air time. [src](https://barbend.com/best-plyometric-exercises/) |
| Power Skip | `power-skip` | none | 0 | locomotion | beginner | high | high | yes | distance | Skip forward driving the knee and opposite arm high to maximize height on each skip. [src](https://barbend.com/best-plyometric-exercises/) |
| Skip in Place | `skip-in-place` | none | 0 | jump | beginner | moderate | high | yes | time | Skip rhythmically in place, lifting alternate knees with a small hop on the support leg. [src](https://barbend.com/best-plyometric-exercises/) |
| High Knees | `high-knees` | none | 0 | jump | beginner | high | high | yes | time | Run in place, driving each knee up to hip height with quick ground contacts. [src](https://barbend.com/best-plyometric-exercises/) |
| Marching High Knees | `marching-high-knees` | none | 0 | locomotion | beginner | low | low | yes | time | March in place driving each knee to hip height with an opposite-arm swing; the no-impact high-knee option. [src](https://barbend.com/best-plyometric-exercises/) |
| Jumping Jack | `jumping-jack` | none | 0 | jump | beginner | moderate | high | yes | reps | Jump the feet wide while raising the arms overhead, then jump back together with arms at the sides. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Step Jack | `step-jack` | none | 0 | locomotion | beginner | low | low | yes | reps | Step one foot out to the side while raising the arms overhead, then return; alternate sides. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Seal Jack | `seal-jack` | none | 0 | jump | beginner | moderate | high | yes | reps | Perform a jumping jack while clapping the arms together in front at shoulder height instead of overhead. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Star Jump | `star-jump` | none | 0 | jump | intermediate | high | high | no | reps | From a quarter squat, explode upward spreading arms and legs into a star shape, then land with feet together. [src](https://www.muscleandfitness.com/muscle-fitness-hers/hers-workouts/8-plyometrics-exercises-you-can-do-without-gym/) |
| Squat Jack | `squat-jack` | none | 0 | jump | intermediate | high | high | yes | reps | Jump the feet out into a wide squat and back together while staying low in the squat. [src](https://barbend.com/best-plyometric-exercises/) |
| Plank Jack | `plank-jack` | none | 0 | jump | beginner | moderate | high | yes | reps | In a high plank, jump the feet out wide and back together while keeping the hips level. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Plyometric Push-Up | `plyo-push-up` | none | 0 | horizontal push | advanced | high | high | no | reps | Lower into a push-up and press explosively so the hands leave the floor, landing softly into the next rep. [src](https://barbend.com/push-up-variations/) |
| Clap Push-Up | `clap-push-up` | none | 0 | horizontal push | advanced | high | high | no | reps | Press explosively out of a push-up and clap the hands before catching yourself in the next rep. [src](https://barbend.com/best-plyometric-exercises/) |
| Hurdle Hop | `hurdle-hop` | hurdle | 0 | jump | intermediate | high | high | no | reps | Hop with both feet over a series of low hurdles or cones with quick, springy contacts. [src](https://www.acefitness.org/resources/everyone/exercise-library/221/forward-hurdle-run/) |
| Box Jump | `box-jump` | box | 0 | jump | intermediate | high | high | no | reps | Jump from two feet onto a box, landing softly and standing to full hip extension on top. BOX REQUIRED. [src](https://www.crossfit.com/essentials/the-box-jump) |
| Box Jump-Over | `box-jump-over` | box | 0 | jump | intermediate | high | high | no | reps | Jump onto or over a box and land on the other side; extension on top is not required. BOX REQUIRED. [src](https://www.crossfit.com/essentials/the-box-jump) |
| Burpee Box Jump-Over | `burpee-box-jump-over` | box | 0 | jump | intermediate | high | high | no | reps | Perform a burpee facing a box, then jump onto or over it to the other side. BOX REQUIRED. [src](https://www.crossfit.com/essentials/the-burpee-box-jump-over) |
| Depth Drop | `depth-drop` | box | 0 | jump | intermediate | moderate | high | no | reps | Step off a low box and absorb the landing into an athletic quarter squat, freezing on contact. BOX REQUIRED. [src](https://barbend.com/best-plyometric-exercises/) |
| Depth Jump | `depth-jump` | box | 0 | jump | advanced | high | high | no | reps | Step off a low box and, on landing, immediately rebound into a maximal vertical jump with minimal ground contact. BOX REQUIRED. [src](https://barbend.com/best-plyometric-exercises/) |
| Seated Box Jump | `seated-box-jump` | box, bench | 0 | jump | intermediate | high | high | no | reps | From sitting on a bench, jump straight onto a box in front of you without a countermovement. BOX REQUIRED. [src](https://barbend.com/best-plyometric-exercises/) |

### weighted_vest (11)

| Name | id | Equipment | DBs | Pattern | Skill | Intensity | Impact | Vest | Unit | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| Weighted Vest Walk | `weighted-vest-walk` | weighted_vest | 0 | locomotion | beginner | low | low | yes | distance | Wear a snug weighted vest (start around 5-10% of bodyweight) and walk briskly with upright posture for time or distance. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Ruck March | `weighted-vest-ruck-march` | weighted_vest | 0 | locomotion | intermediate | moderate | low | yes | distance | Walk at a fast, sustained pace over longer distances under a loaded vest or rucksack. [src](https://barbend.com/rucking/) |
| Weighted Vest Hill/Incline Walk | `weighted-vest-incline-walk` | weighted_vest, hill_or_treadmill | 0 | locomotion | intermediate | moderate | low | yes | distance | Walk uphill (outdoor hill or inclined treadmill) wearing a weighted vest, keeping an upright torso. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Weighted Vest Hike | `weighted-vest-hike` | weighted_vest, outdoor_trail | 0 | locomotion | intermediate | moderate | low | yes | distance | Hike varied terrain wearing a weighted vest at a steady, conversational effort. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Weighted Vest Run | `weighted-vest-run` | weighted_vest | 0 | locomotion | advanced | high | high | yes | distance | Run short-to-moderate distances wearing a light, snug vest; keep loads light to protect joints. [src](https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment) |
| Weighted Vest Shuttle Run | `weighted-vest-shuttle-run` | weighted_vest | 0 | locomotion | advanced | high | high | yes | distance | Perform shuttle runs between two lines wearing a weighted vest, decelerating under control at each turn. [src](https://spmembersonly.com/no-equipment) |
| Weighted Vest Stair Climb | `weighted-vest-stair-climb` | weighted_vest, stairs | 0 | locomotion | intermediate | high | low | yes | time | Climb flights of stairs at a steady pace wearing a weighted vest, walking down for recovery. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Weighted Vest Step-Up | `weighted-vest-step-up` | weighted_vest, box | 0 | lunge | intermediate | moderate | low | yes | reps | Wearing a weighted vest, step onto a sturdy step, bench, or box and stand fully before stepping down. [src](https://beginnerfitpath.com/weighted-vest-training/) |
| Weighted Vest March in Place | `weighted-vest-march-in-place` | weighted_vest | 0 | locomotion | beginner | low | low | yes | time | March in place with high knees and an opposite arm swing while wearing a weighted vest; a quiet indoor vest option. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Weighted Vest Plank | `weighted-vest-plank` | weighted_vest | 0 | core/midline | intermediate | low | low | yes | time | Hold a front plank wearing a weighted vest, keeping the hips from sagging under the extra load. [src](https://beginnerfitpath.com/weighted-vest-training/) |
| Weighted Vest Bear Crawl | `weighted-vest-bear-crawl` | weighted_vest | 0 | locomotion | intermediate | moderate | low | yes | distance | Bear crawl forward and back wearing a weighted vest, keeping the knees an inch off the ground and the back flat. [src](https://www.acefitness.org/resources/everyone/exercise-library/150/bear-crawl/) |

## Warm-up drills by type

### general_raise (16)

| Name | id | Equipment | Targets | Prepares | Dose | Description |
|---|---|---|---|---|---|---|
| Easy Jog | `wu-easy-jog` | none | full body, calves, hips | locomotion, jump, lunge, squat | 2-4 min or 400 m | Jog at a conversational pace to raise heart rate and tissue temperature. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Jog in Place | `wu-jog-in-place` | none | calves, hips, full body | locomotion, jump | 60-90 sec | Jog lightly in place on the balls of the feet with relaxed arms; a quiet indoor raise. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Light Jumping Jacks | `wu-light-jumping-jacks` | none | calves, shoulders, full body | jump, locomotion, vertical push | 30-60 sec | Perform easy-paced jumping jacks to elevate heart rate and loosen the shoulders and hips. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Easy Single-Unders | `wu-easy-single-unders` | jump_rope | calves, ankles, forearms | jump, locomotion | 1-2 min | Jump rope at a relaxed tempo with minimal jump height to raise the heart rate and prime the ankles. [src](https://wodprep.com/blog/beginner-progression-double-unders/) |
| Jump Rope Boxer Step Warm-Up | `wu-jump-rope-boxer-step` | jump_rope | calves, ankles | jump, locomotion | 1-2 min | Use a relaxed boxer step over the rope as a low-intensity, low-impact raise. [src](https://doperopes.co.uk/pages/jump-rope-training-footwork-series) |
| High-Knee March | `wu-high-knee-march` | none | hip flexors, glutes, core | locomotion, lunge, squat | 30-60 sec | March with exaggerated knee drive and opposite arm swing while standing tall. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Butt Kicks | `wu-butt-kicks` | none | quadriceps, hamstrings | locomotion, jump, lunge | 30 sec or 20 m | Jog lightly while flicking the heels toward the glutes. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| A-Skip | `wu-a-skip` | none | hip flexors, calves, glutes | locomotion, jump | 2 x 15-20 m | Skip forward driving one knee to hip height and striking down under the hips with a dorsiflexed foot. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Carioca | `wu-carioca` | none | hips, adductors, obliques | locomotion, lunge, rotation | 2 x 15-20 m/side | Move laterally by alternately crossing the trail leg in front of and behind the lead leg while rotating the hips. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Lateral Shuffle Warm-Up | `wu-lateral-shuffle` | none | glute medius, adductors, calves | locomotion, lunge, jump | 2 x 15 m/direction | Shuffle sideways in an athletic stance without crossing the feet. [src](https://www.acefitness.org/resources/everyone/exercise-library/181/lateral-shuffles/) |
| Backpedal | `wu-backpedal` | none | quadriceps, calves | locomotion, jump | 2 x 15-20 m | Jog backward on the balls of the feet with a slight forward lean. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Forward Skip | `wu-forward-skip` | none | calves, hip flexors | locomotion, jump | 2 x 20 m | Skip forward rhythmically with an easy arm swing. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Shadow Boxing | `wu-shadow-boxing` | none | shoulders, core, calves | rotation, horizontal push, locomotion | 60-90 sec | Throw light punches in an athletic, bouncing stance, rotating through the hips. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Bear Crawl Warm-Up | `wu-bear-crawl` | none | shoulders, wrists, core, quadriceps | horizontal push, vertical push, core/midline, locomotion | 2 x 10 m | Crawl forward and back with knees hovering to warm the shoulders, wrists, and trunk. [src](https://www.acefitness.org/resources/everyone/exercise-library/150/bear-crawl/) |
| Slow Mountain Climbers | `wu-slow-mountain-climbers` | none | hip flexors, core, shoulders | core/midline, horizontal push, locomotion | 30 sec | From a high plank, drive alternate knees toward the chest at a slow, controlled tempo. [src](https://www.acefitness.org/resources/everyone/exercise-library/258/mountain-climbers/) |
| Step Jacks | `wu-step-jacks` | none | shoulders, hips | locomotion, vertical push | 30-60 sec | Alternate stepping one foot out while raising the arms overhead; a quiet, no-jump raise. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |

### activation (22)

| Name | id | Equipment | Targets | Prepares | Dose | Description |
|---|---|---|---|---|---|---|
| Glute Bridge (activation) | `wu-glute-bridge` | none | glutes, hamstrings | hinge, squat, lunge, jump | 2 x 10-15 | Lie on your back and drive the hips up with a 2-second squeeze at the top. [src](https://www.acefitness.org/resources/everyone/exercise-library/49/glute-bridge/) |
| Single-Leg Glute Bridge (activation) | `wu-single-leg-glute-bridge` | none | glutes, hamstrings | hinge, lunge, jump | 2 x 8/side | Bridge on one leg keeping the pelvis level, pausing at the top. [src](https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/) |
| Clamshell | `wu-clamshell` | none | glute medius, hip external rotators | squat, lunge, jump | 2 x 12/side | Lie on your side with knees bent and lift the top knee while keeping the feet together and pelvis still. [src](https://www.acefitness.org/resources/everyone/exercise-library/38/side-lying-hip-abduction/) |
| Side-Lying Leg Raise | `wu-side-lying-leg-raise` | none | glute medius | squat, lunge, jump, locomotion | 2 x 12/side | Lying on your side, raise the straight top leg slightly behind the body and lower slowly. [src](https://www.acefitness.org/resources/everyone/exercise-library/38/side-lying-hip-abduction/) |
| Fire Hydrant | `wu-fire-hydrant` | none | glute medius, hip abductors | squat, lunge, jump | 2 x 10/side | On hands and knees, lift one bent knee out to the side without shifting the torso. [src](https://www.acefitness.org/resources/everyone/exercise-library/109/dirty-dog/) |
| Quadruped Hip Extension | `wu-quadruped-hip-extension` | none | glutes | hinge, lunge | 2 x 10/side | On hands and knees, drive one bent knee back and up until the thigh is parallel to the floor without arching the back. [src](https://www.acefitness.org/resources/everyone/exercise-library/270/quadruped-bent-knee-hip-extensions/) |
| Banded Lateral Walk | `wu-band-lateral-walk` | band | glute medius, hip abductors | squat, lunge, jump | 2 x 10 steps/direction | With a mini-band around the knees or ankles, step sideways in a quarter squat keeping tension on the band. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Band Pull-Apart | `wu-band-pull-apart` | band | rear deltoids, rhomboids, mid traps | horizontal pull, vertical push, horizontal push, full-body/olympic-style, vertical pull | 2 x 15 | Hold a light band at shoulder height with straight arms and pull it apart to the chest. [src](https://www.crossfit.com/essentials/the-dumbbell-power-snatch) |
| Bird Dog (activation) | `wu-bird-dog` | none | erector spinae, glutes, core | hinge, core/midline, carry | 2 x 6-8/side | Extend the opposite arm and leg from hands and knees with a 2-second hold, keeping the hips square. [src](https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/) |
| Dead Bug (activation) | `wu-dead-bug` | none | deep core | core/midline, squat, hinge, vertical push | 2 x 6-8/side | On your back, slowly lower opposite arm and leg while keeping the low back pressed down. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Plank Hold (activation) | `wu-plank-hold` | none | core, shoulders | core/midline, horizontal push, carry | 2 x 20-30 sec | Hold a forearm or high plank with glutes squeezed and ribs down. [src](https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/) |
| Side Plank (activation) | `wu-side-plank` | none | obliques, glute medius | core/midline, carry, lunge | 2 x 15-20 sec/side | Hold a side plank with hips stacked and lifted. [src](https://www.acefitness.org/resources/everyone/exercise-library/303/side-plank/) |
| Hollow Hold (activation) | `wu-hollow-hold` | none | anterior core | core/midline, vertical push, jump, full-body/olympic-style | 2-3 x 15-20 sec | Press the low back to the floor and hold the hollow shape; scale with bent knees or arms forward. [src](https://barbend.com/hollow-hold/) |
| Superman Hold (activation) | `wu-superman-hold` | none | erector spinae, glutes | hinge, full-body/olympic-style, horizontal pull | 2 x 15-20 sec | Lying face down, lift arms, chest, and legs and hold. [src](https://www.acefitness.org/resources/everyone/exercise-library/9/supermans/) |
| Scap Push-Up | `wu-scap-push-up` | none | serratus anterior, shoulder blades | horizontal push, vertical push | 2 x 10 | In a high plank with straight arms, let the chest sink between the shoulder blades, then push the floor away to spread them. [src](https://www.acefitness.org/resources/everyone/exercise-library/259/ckc-parascapular-exercises/) |
| Prone Y-T-W Raises | `wu-prone-ytw` | none | lower traps, rhomboids, rotator cuff | vertical push, horizontal pull, vertical pull, full-body/olympic-style | 1-2 x 6 each letter | Lying face down, raise the arms into Y, T, and W shapes with thumbs up, squeezing the shoulder blades. [src](https://www.acefitness.org/resources/everyone/exercise-library/249/prone-scapular-shoulder-stabilization-series-i-y-t-w-o-formation/) |
| Side-Lying Dumbbell External Rotation | `wu-db-external-rotation` | dumbbell | rotator cuff | vertical push, horizontal push, full-body/olympic-style | 2 x 10-12/side (very light) | Lying on your side with the elbow pinned to the ribs, rotate a very light dumbbell up from the belly. [src](https://www.acefitness.org/resources/everyone/exercise-library/352/rotator-cuff-external-rotation/) |
| Tibialis Raise | `wu-tibialis-raise` | wall | tibialis anterior, ankles | jump, locomotion | 2 x 15 | Lean your back against a wall with heels forward and lift the toes toward the shins, then lower. [src](https://barbend.com/ankle-mobility-exercises/) |
| Calf Raise (activation) | `wu-calf-raise` | none | calves, Achilles tendon | jump, locomotion | 2 x 15 | Rise slowly onto the toes and lower under control to prepare the ankles for jumping. [src](https://www.acefitness.org/resources/everyone/exercise-library/73/standing-calf-raises-wall/) |
| Single-Leg Balance Reach | `wu-single-leg-balance` | none | ankles, hip stabilizers | lunge, jump, hinge | 2 x 20-30 sec/side | Stand on one leg and reach the free leg or arms in several directions while keeping balance. [src](https://www.acefitness.org/resources/everyone/exercise-library/114/single-leg-stand-with-reaches/) |
| Glute Bridge March (activation) | `wu-glute-bridge-march` | none | glutes, core | hinge, lunge, locomotion | 2 x 8/side | Hold a bridge and alternately lift each foot without the hips dropping. [src](https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/) |
| Bear Hold Shoulder Taps | `wu-bear-hold-shoulder-tap` | none | core, shoulders | core/midline, horizontal push, carry | 2 x 8/side | In a bear hold with knees hovering, tap opposite shoulders without rocking the hips. [src](https://spmembersonly.com/pp-movement-library) |

### dynamic_mobility (28)

| Name | id | Equipment | Targets | Prepares | Dose | Description |
|---|---|---|---|---|---|---|
| Arm Circles | `wu-arm-circles` | none | shoulders | vertical push, horizontal push, full-body/olympic-style, horizontal pull, vertical pull | 10 forward + 10 back | Circle straight arms in small then large circles forward and backward. [src](https://www.crossfit.com/essentials/purpose-of-the-general-warm-up) |
| Cross-Body Arm Swings | `wu-arm-swings` | none | chest, upper back, shoulders | horizontal push, horizontal pull, vertical push | 15-20 reps | Swing the arms wide open and then across the chest in a hugging motion, alternating which arm is on top. [src](https://www.crossfit.com/essentials/purpose-of-the-general-warm-up) |
| Leg Swings (Front-to-Back) | `wu-leg-swings-front` | wall | hamstrings, hip flexors | hinge, lunge, locomotion, jump | 10-15/side | Holding a wall for balance, swing one straight leg forward and back through a growing range. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Leg Swings (Side-to-Side) | `wu-leg-swings-lateral` | wall | adductors, hip abductors | squat, lunge, locomotion | 10-15/side | Facing a wall, swing one leg across the body and out to the side. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Standing Hip Circles | `wu-hip-circles` | none | hips, groin | squat, lunge, locomotion | 8-10/direction/side | Lift one knee and draw a big circle out to the side and back (gate opener), then reverse (gate closer). [src](https://www.acefitness.org/resources/everyone/exercise-library/201/standing-gate-openers-frankensteins/) |
| Frankenstein Walk | `wu-frankensteins` | none | hamstrings | hinge, locomotion | 2 x 10 m | Walk forward kicking a straight leg up toward the opposite outstretched hand. [src](https://www.acefitness.org/resources/everyone/exercise-library/201/standing-gate-openers-frankensteins/) |
| Walking Knee Hug | `wu-walking-knee-hug` | none | glutes, hip flexors | lunge, squat, locomotion | 10 m or 8/side | Step forward, pull one knee to the chest while rising onto the toes, then step and switch. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Walking Quad Pull | `wu-walking-quad-pull` | none | quadriceps, hip flexors | lunge, locomotion, jump | 10 m or 8/side | Step forward and pull the opposite heel to the glute while reaching the free arm overhead. [src](https://barbend.com/quad-stretches/) |
| Cat-Cow | `wu-cat-cow` | none | spine, thoracic, low back | hinge, core/midline, full-body/olympic-style | 8-10 slow reps | On hands and knees, alternate rounding the spine up and letting it sag with the chest forward, moving with the breath. [src](https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/) |
| Thread the Needle (dynamic) | `wu-thread-the-needle` | none | thoracic spine, shoulders | rotation, vertical push, horizontal pull, full-body/olympic-style | 8/side | From hands and knees, reach one arm under the body and then up toward the ceiling, following the hand with the eyes. [src](https://www.acefitness.org/resources/everyone/exercise-library/330/high-plank-t-spine-rotation/) |
| Open Book | `wu-open-book` | none | thoracic spine, chest | rotation, horizontal push, vertical push, horizontal pull | 8/side | Lying on your side with knees bent, rotate the top arm open across the body to the floor behind you and back. [src](https://www.acefitness.org/resources/everyone/exercise-library/223/side-lying-arm-rolls/) |
| World's Greatest Stretch | `wu-worlds-greatest-stretch` | none | hip flexors, hamstrings, thoracic spine, adductors | lunge, squat, hinge, rotation, full-body/olympic-style | 5/side | From a long lunge, place the inside elbow toward the instep, rotate the arm to the ceiling, then straighten the front leg. [src](https://www.acefitness.org/resources/everyone/exercise-library/140/lunge-with-elbow-instep/) |
| Spiderman Lunge | `wu-spiderman-lunge` | none | hip flexors, adductors, groin | lunge, squat, locomotion | 5-8/side | Step a foot outside the hand into a deep lunge, sink the hips, then step to the other side. [src](https://www.acefitness.org/resources/everyone/exercise-library/140/lunge-with-elbow-instep/) |
| Inchworm (warm-up) | `wu-inchworm` | none | hamstrings, shoulders, core | hinge, horizontal push, core/midline | 5-8 reps | Walk the hands out to a plank and walk the feet back in toward the hands, keeping the legs as straight as comfortable. [src](https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/) |
| Down Dog to Cobra Flow | `wu-down-dog-to-cobra` | none | hamstrings, calves, spine, chest | hinge, horizontal push, vertical push, core/midline | 6-8 reps | Flow from downward-facing dog to a cobra or upward dog and back, moving with the breath. [src](https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/) |
| Hip Rotations in Push-Up Position | `wu-hip-rotations-push-up` | none | hips, core, shoulders | core/midline, rotation, horizontal push | 6/side | From a push-up position, rotate one bent knee under the body toward the opposite side and back. [src](https://www.acefitness.org/resources/everyone/exercise-library/110/hip-rotations-push-up-position/) |
| Squat-to-Stand | `wu-squat-to-stand` | none | hamstrings, hips, ankles | squat, hinge | 8 reps | Fold forward to hold the toes, drop the hips into a deep squat with chest up, then straighten the legs while holding the toes. [src](https://www.acefitness.org/resources/everyone/exercise-library/361/squat-to-overhead-raise/) |
| Samson Stretch | `wu-samson-stretch` | none | hip flexors, quadriceps, lats | lunge, vertical push, squat | 3-5 x 5 sec/side | In a long lunge with arms locked overhead, drive the hips forward and reach up. [src](https://www.crossfit.com/essentials/purpose-of-the-general-warm-up) |
| 90/90 Hip Switches | `wu-9090-hip-switch` | none | hip internal/external rotators | squat, lunge, rotation | 8-10 switches | Sit with both knees bent 90 degrees to one side and rotate the knees to the other side without using the hands if possible. [src](https://health.clevelandclinic.org/90-90-stretch) |
| Knee-to-Wall Ankle Rocks | `wu-ankle-rocks` | wall | ankles, calves | squat, jump, lunge | 10/side | In a half-kneeling or split stance, drive the front knee forward over the toes toward a wall without lifting the heel. [src](https://www.acefitness.org/resources/everyone/exercise-library/224/standing-ankle-mobilization/) |
| Wrist Circles and Rocks | `wu-wrist-prep` | none | wrists, forearms | horizontal push, vertical push, full-body/olympic-style, core/midline | 10 each direction | Circle the wrists, then on hands and knees rock forward and back over the palms with fingers forward, sideways, and back. [src](https://library.crossfit.com/free/pdf/08_03_Better_warmup.pdf) |
| Neck Half Circles | `wu-neck-half-circles` | none | neck | carry, vertical push, full-body/olympic-style | 5/direction | Slowly roll the chin from one shoulder down across the chest to the other shoulder. [src](https://www.acefitness.org/resources/everyone/exercise-library/204/neck-flexion-and-extension/) |
| Band or PVC Pass-Through | `wu-pass-through` | band_or_pvc | shoulders, chest | vertical push, full-body/olympic-style, horizontal push, vertical pull | 10-15 reps | Hold a band or dowel with a wide grip and lift it overhead and behind the body with straight arms, then back. [src](https://www.crossfit.com/essentials/the-dumbbell-power-snatch) |
| Walking Lunge with Overhead Reach | `wu-walking-lunge-reach` | none | hip flexors, quadriceps, lats | lunge, vertical push, locomotion | 10 m or 6/side | Walk forward in lunges, reaching both arms overhead and slightly toward the front-leg side at the bottom. [src](https://www.acefitness.org/resources/everyone/exercise-library/363/lunge/) |
| Reverse Lunge with Twist | `wu-reverse-lunge-twist` | none | hip flexors, thoracic spine, obliques | lunge, rotation | 6/side | Step back into a lunge and rotate the torso toward the front leg, then return. [src](https://www.acefitness.org/resources/everyone/exercise-library/360/reverse-lunge-with-rotation/) |
| Cossack Shifts | `wu-cossack-shift` | none | adductors, hips, ankles | squat, lunge | 6/side | From a wide stance, shift slowly into a deep side squat on one leg, then the other, staying low. [src](https://www.acefitness.org/resources/everyone/exercise-library/364/lateral-lunge/) |
| Prone Scorpion | `wu-scorpion` | none | hip flexors, thoracic spine, low back | rotation, lunge, hinge | 6/side | Lying face down with arms out, lift one foot and reach it across the body toward the opposite hand. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Deep Squat Pry | `wu-deep-squat-pry` | dumbbell | hips, ankles, adductors | squat, full-body/olympic-style | 30-60 sec | Sit in the bottom of a squat holding a light dumbbell at the chest and use the elbows to gently pry the knees out while shifting side to side. [src](https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/) |

### movement_prep (28)

| Name | id | Equipment | Targets | Prepares | Dose | Description |
|---|---|---|---|---|---|---|
| Light Dumbbell Complex | `wu-db-complex-light` | dumbbell | full body | full-body/olympic-style, hinge, squat, vertical push | 2-3 rounds of 5 reps each move | With light dumbbells, perform 5 deadlifts, 5 hang power cleans, 5 front squats, and 5 push presses without putting them down. [src](https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf) |
| Dumbbell Snatch Progression | `wu-db-snatch-progression` | dumbbell | hips, shoulders | full-body/olympic-style, hinge, vertical push | 2 x 5 each step/side | With a light dumbbell, perform deadlift, high pull, muscle snatch, then hang power snatch in sequence. [src](https://www.crossfit.com/essentials/the-dumbbell-power-snatch) |
| Dumbbell Clean Progression | `wu-db-clean-progression` | dumbbell | hips, upper back, wrists | full-body/olympic-style, squat, hinge | 2 x 5 each step | With light dumbbells, perform hang muscle clean, hang power clean, then front squat to rehearse the rack. [src](https://www.crossfit.com/essentials/the-dumbbell-hang-power-clean) |
| Dip-Drive Drill | `wu-db-push-press-drill` | dumbbell | quadriceps, shoulders | vertical push, full-body/olympic-style | 2 x 8 | With light dumbbells at the shoulders, rehearse a vertical dip and drive to the toes, then add a press. [src](https://www.crossfit.com/essentials/the-dumbbell-push-press) |
| Tempo Goblet Squat | `wu-goblet-squat-tempo` | dumbbell | quadriceps, glutes, ankles | squat, lunge | 2 x 6 (3-sec lower) | Hold a light dumbbell at the chest and lower for three seconds to full depth, then stand. [src](https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/) |
| Light Dumbbell RDL | `wu-db-rdl-light` | dumbbell | hamstrings, glutes | hinge, full-body/olympic-style | 2 x 8 | Perform slow Romanian deadlifts with light dumbbells to groove the hinge. [src](https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/) |
| Hip Hinge Drill | `wu-hip-hinge-drill` | none | hamstrings, glutes, low back | hinge, full-body/olympic-style | 2 x 8 | With hands on hips or a dowel along the spine, push the hips back to a hinge keeping a neutral spine. [src](https://www.acefitness.org/resources/everyone/exercise-library/33/hip-hinge/) |
| Turkish Get-Up Practice (Unloaded) | `wu-tgu-practice` | none | shoulders, hips, core | core/midline, full-body/olympic-style, vertical push | 2-3/side | Rehearse each step of the get-up with a shoe balanced on the fist or no load. [src](https://www.crossfit.com/essentials/the-dumbbell-turkish-get-up) |
| Light Dumbbell Halo | `wu-db-halo` | dumbbell | shoulders, upper back | vertical push, full-body/olympic-style, core/midline, vertical pull | 5/direction | Circle a light dumbbell around the head close to the neck in both directions. [src](https://www.acefitness.org/resources/everyone/exercise-library/394/halo/) |
| Light Single-Arm Row | `wu-db-single-arm-row-light` | dumbbell | lats, upper back | horizontal pull, vertical pull | 2 x 10/side | Perform easy single-arm rows with a light dumbbell, focusing on scapular movement. [src](https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/) |
| Air Squat Build-Up | `wu-air-squat-build` | none | quadriceps, glutes, ankles | squat, lunge, jump | 2 x 10 | Perform air squats, gradually increasing depth and speed. [src](https://www.crossfit.com/essentials/the-air-squat) |
| Push-Up Negatives | `wu-push-up-negatives` | none | chest, triceps, core | horizontal push, vertical push | 2 x 5 (3-sec lower) | From the top of a push-up, lower for three seconds to the floor, then reset on the knees. [src](https://www.crossfit.com/essentials/the-push-up) |
| Pike Shoulder Shrug | `wu-pike-shoulder-shrug` | none | shoulders, upper traps | vertical push | 2 x 10 | In a pike position, shrug the shoulders toward the ears and push the floor away without bending the elbows. [src](https://www.crossfit.com/essentials/handstand-push-up-variations) |
| Burpee Breakdown | `wu-burpee-breakdown` | none | full body | full-body/olympic-style, horizontal push, jump | 5 slow reps | Step back to plank, lower to the floor, push up, step in, and stand, gradually adding the jump. [src](https://www.crossfit.com/essentials/the-burpee-2) |
| Penguin Jumps | `wu-penguin-jumps` | none | calves, core | jump | 2 x 8-10 | Jump with straight, tight legs and tap the thighs twice with the hands before landing. [src](https://www.crossrope.com/blogs/blog/how-to-do-double-unders/) |
| Rope Handle Flicks (No Jump) | `wu-rope-handle-flicks` | jump_rope | wrists, forearms | jump | 2 x 30 sec | Hold both handles in one hand and spin the rope beside you from the wrist to build turning speed. [src](https://wodprep.com/blog/beginner-progression-double-unders/) |
| Single-Single-Double Drill | `wu-single-single-double` | jump_rope | calves, wrists | jump | 3-5 x 30 sec | Perform two single-unders then one double-under on repeat, building toward consecutive double-unders. [src](https://wodprep.com/blog/beginner-progression-double-unders/) |
| High Single-Unders | `wu-high-singles` | jump_rope | calves, ankles | jump | 2 x 10 | Jump single-unders at double-under height with a tight body to rehearse jump timing. [src](https://wodprep.com/blog/beginner-progression-double-unders/) |
| Pogo Hops (prep) | `wu-pogo-hops` | none | calves, Achilles tendon | jump, locomotion | 2 x 10-15 | Bounce lightly on the balls of the feet with stiff ankles and fast contacts. [src](https://barbend.com/best-plyometric-exercises/) |
| Snap-Down | `wu-snap-down` | none | quadriceps, glutes, ankles | jump, squat | 2 x 5 | From tall on the toes with arms overhead, snap the arms down and drop into a quiet athletic quarter squat; hold 2 seconds. [src](https://movekit.com/exercises/snap-down-landing) |
| Squat Jump to Stick | `wu-jump-to-stick` | none | quadriceps, glutes, ankles | jump | 2 x 5 | Perform a small vertical jump and land softly, freezing in a balanced quarter squat with knees tracking over toes. [src](https://movekit.com/exercises/snap-down-landing) |
| Split-Stance Snap-Down | `wu-split-stance-stick` | none | quadriceps, glutes, hip stabilizers | jump, lunge | 2 x 4/side | Snap down from tall into a split stance and stick the landing quietly. [src](https://movekit.com/exercises/snap-down-landing) |
| Single-Leg Hop to Stick (prep) | `wu-single-leg-hop-stick` | none | ankles, knees, glutes | jump, locomotion | 2 x 4/side | Hop a short distance on one leg and freeze the landing for two seconds. [src](https://movekit.com/exercises/snap-down-landing) |
| Low Line Hops | `wu-low-line-hops` | none | calves, ankles | jump | 2 x 10-15 | Hop lightly side to side or front to back over a line with small amplitude to prepare for jumping. [src](https://spmembersonly.com/no-equipment) |
| Build-Up Strides | `wu-run-strides` | none | hamstrings, calves, hip flexors | locomotion, jump | 3-4 x 30-50 m | Run gradually accelerating to about 80-90% speed over the distance, then walk back. [src](https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf) |
| Split Squat Isometric Hold | `wu-split-squat-iso` | none | quadriceps, glutes, hip flexors | lunge, squat | 2 x 20 sec/side | Hold the bottom of a split squat with the back knee just above the floor. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Easy Vest Walk | `wu-vest-walk-easy` | weighted_vest | full body, calves | locomotion, carry | 3-5 min | Walk easily wearing the vest before vest work to let the body adapt to the load. [src](https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training) |
| Light Farmers Hold | `wu-farmer-hold-light` | dumbbell | forearms, traps, core | carry, hinge | 2 x 20-30 sec | Hold moderate dumbbells at the sides standing tall to prime grip and bracing. [src](https://www.crossfit.com/essentials/the-farmer-carry) |

## Stretches / cooldown by type

### static_stretch (65)

| Name | id | Equipment | Targets | Pairs with | Hold | Description |
|---|---|---|---|---|---|---|
| Upper Trapezius Stretch | `st-upper-trap-stretch` | none | neck, upper traps | carry, vertical push, full-body/olympic-style, hinge | 30 sec/side | Tilt the ear toward the shoulder and gently assist with the same-side hand while the opposite shoulder relaxes down. [src](https://www.acefitness.org/resources/everyone/exercise-library/202/lateral-neck-flexion/) |
| Levator Scapulae Stretch | `st-levator-scapulae-stretch` | none | neck, levator scapulae | carry, vertical push, horizontal pull | 30 sec/side | Turn the head about 45 degrees and look down toward the armpit, gently pulling the head down with the hand. [src](https://library.theprehabguys.com/vimeo-video/neck-stretch/) |
| Scalene Stretch | `st-scalene-stretch` | none | neck, scalenes | carry, vertical push | 30 sec/side | Anchor one shoulder down, tilt the head away and slightly back, looking up diagonally. [src](https://library.theprehabguys.com/vimeo-video/neck-stretch/) |
| Cross-Body Shoulder Stretch | `st-cross-body-shoulder` | none | rear deltoids, posterior shoulder | horizontal pull, vertical push, horizontal push, full-body/olympic-style | 30 sec/side | Pull one straight arm across the chest with the other hand, keeping the shoulder down. [src](https://orthoinfo.aaos.org/en/recovery/rotator-cuff-and-shoulder-conditioning-program/) |
| Sleeper Stretch | `st-sleeper-stretch` | none | posterior shoulder, rotator cuff | vertical push, full-body/olympic-style, horizontal push | 30 sec/side | Lying on one side with the bottom arm at 90 degrees, gently press the forearm toward the floor. [src](https://orthoinfo.aaos.org/en/recovery/rotator-cuff-and-shoulder-conditioning-program/) |
| Overhead Triceps Stretch | `st-overhead-triceps` | none | triceps, lats | vertical push, horizontal push, full-body/olympic-style | 30 sec/side | Reach one arm overhead, bend the elbow behind the head, and gently pull the elbow with the other hand. [src](https://www.acefitness.org/resources/everyone/exercise-library/174/overhead-triceps-stretch/) |
| Standing Shoulder Extension Stretch | `st-shoulder-extension` | none | anterior shoulders, chest, biceps | horizontal push, vertical push, carry | 30 sec | Clasp the hands behind the back and lift the arms away from the body while the chest stays tall. [src](https://www.acefitness.org/resources/everyone/exercise-library/199/standing-shoulder-extension/) |
| Standing Chest Stretch | `st-standing-chest` | none | chest, anterior shoulders | horizontal push, vertical push | 30 sec | Interlace the fingers behind the back, squeeze the shoulder blades, and open the chest. [src](https://www.acefitness.org/resources/everyone/exercise-library/209/standing-chest-stretch/) |
| Doorway Pec Stretch | `st-doorway-pec` | wall | chest, anterior shoulders | horizontal push, vertical push | 30-45 sec/side | Place the forearm on a doorframe or wall at shoulder height and step through until the chest stretches. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |
| Prone Single-Arm Pec Stretch | `st-prone-pec` | none | chest, anterior shoulder | horizontal push, vertical push | 30-45 sec/side | Lie face down with one arm out at 90 degrees and roll away from it, bracing with the other hand. [src](https://www.acefitness.org/resources/everyone/exercise-library/209/standing-chest-stretch/) |
| Seated Biceps Stretch | `st-biceps-stretch` | none | biceps, anterior shoulders | horizontal pull, vertical pull, carry | 30 sec | Sit with knees bent, hands behind you with fingers pointing back, and slide the hips forward. [src](https://www.acefitness.org/resources/everyone/exercise-library/208/seated-bent-knee-biceps-stretch/) |
| Puppy Pose | `st-puppy-pose` | none | lats, shoulders, thoracic spine | vertical push, full-body/olympic-style, horizontal pull, vertical pull | 45-60 sec | From hands and knees, walk the hands forward and lower the chest toward the floor with hips over the knees. [src](https://www.acefitness.org/resources/everyone/exercise-library/227/childs-pose/) |
| Thread the Needle Hold | `st-thread-the-needle-hold` | none | thoracic spine, rear shoulders | rotation, horizontal pull, vertical push | 30-45 sec/side | From hands and knees, slide one arm under the body and rest that shoulder and ear on the floor. [src](https://www.acefitness.org/resources/everyone/exercise-library/330/high-plank-t-spine-rotation/) |
| Open Book Hold | `st-open-book-hold` | none | thoracic spine, chest | rotation, horizontal push | 30-45 sec/side | Lie on your side with knees stacked and bent, and rotate the top arm open to rest behind you. [src](https://www.acefitness.org/resources/everyone/exercise-library/223/side-lying-arm-rolls/) |
| Seated Spinal Twist | `st-seated-spinal-twist` | none | thoracic spine, obliques, glutes | rotation, core/midline, hinge | 30 sec/side | Sit with one knee bent and crossed over the straight leg, and rotate toward the bent knee using the opposite elbow. [src](https://orthoinfo.aaos.org/en/recovery/hip-conditioning-program/) |
| Supine Spinal Twist | `st-supine-twist` | none | low back, thoracic spine, glutes | rotation, hinge, core/midline | 30-60 sec/side | Lie on your back, drop bent knees to one side, and keep both shoulders on the floor. [src](https://www.acefitness.org/resources/everyone/exercise-library/229/supine-spinal-twist-with-rib-grab-and-progressions/) |
| Bench Thoracic Extension Stretch | `st-bench-thoracic-extension` | bench | thoracic spine, lats, triceps | vertical push, full-body/olympic-style | 30-45 sec | Kneel facing a bench, place the elbows on it with hands together, and sink the chest down while bending the elbows. [src](https://www.acefitness.org/resources/everyone/exercise-library/141/kneeling-lat-stretch-w-bench/) |
| Sphinx Pose | `st-sphinx` | none | low back, abdominals, hip flexors | hinge, core/midline | 30-60 sec | Lie face down and prop up on the forearms, letting the low back and belly relax. [src](https://www.acefitness.org/resources/everyone/exercise-library/16/cobra/) |
| Cobra Stretch | `st-cobra` | none | abdominals, hip flexors, spine | core/midline, hinge | 20-30 sec x 2 | Lying face down with hands under the shoulders, press the chest up while the hips stay down. [src](https://www.acefitness.org/resources/everyone/exercise-library/16/cobra/) |
| Upward-Facing Dog | `st-upward-dog` | none | abdominals, hip flexors, chest | core/midline, horizontal push | 20-30 sec | From prone, press up through straight arms lifting the thighs off the floor and opening the chest. [src](https://www.acefitness.org/resources/everyone/exercise-library/244/upward-facing-dog/) |
| Child's Pose | `st-childs-pose` | none | low back, lats, hips | hinge, squat, vertical push, core/midline | 45-90 sec | Sit the hips back to the heels with knees apart and arms extended forward, breathing into the back. [src](https://www.acefitness.org/resources/everyone/exercise-library/227/childs-pose/) |
| Side-Reach Child's Pose | `st-side-reach-childs-pose` | none | lats, obliques | vertical push, vertical pull, full-body/olympic-style | 30 sec/side | From child's pose, walk both hands to one side to lengthen the opposite lat. [src](https://www.acefitness.org/resources/everyone/exercise-library/227/childs-pose/) |
| 90 Lat Stretch | `st-90-lat-stretch` | none | lats | vertical push, vertical pull, horizontal pull, full-body/olympic-style | 30 sec/side | Stand facing a support, hold it at about hip height, and sit the hips back while reaching through one arm. [src](https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/) |
| Kneeling Lat Stretch on Bench | `st-kneeling-lat-bench` | bench | lats, triceps | vertical push, vertical pull, full-body/olympic-style | 30 sec/side | Kneel beside a bench, place one forearm on it, and sink the hips back and chest down. [src](https://www.acefitness.org/resources/everyone/exercise-library/141/kneeling-lat-stretch-w-bench/) |
| Standing Side Bend | `st-standing-side-bend` | none | lats, obliques, quadratus lumborum | carry, rotation, vertical push | 20-30 sec/side | Reach one arm overhead and lean the torso to the opposite side without twisting. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |
| Wrist Flexor Stretch | `st-wrist-flexor` | none | wrist flexors, forearms | horizontal push, vertical push, carry, full-body/olympic-style | 30 sec/side | With the arm straight and palm up, gently pull the fingers back toward you. [src](https://health.clevelandclinic.org/wrist-pain-exercises) |
| Wrist Extensor Stretch | `st-wrist-extensor` | none | wrist extensors, forearms | carry, horizontal pull, full-body/olympic-style | 30 sec/side | With the arm straight and palm down, gently pull the back of the hand toward you. [src](https://health.clevelandclinic.org/wrist-pain-exercises) |
| Prayer Stretch | `st-prayer-stretch` | none | wrist flexors | horizontal push, vertical push | 30 sec | Press the palms together in front of the chest and lower the hands while keeping the palms in contact. [src](https://thewell.northwell.edu/joint-health-orthopedics/wrist-exercises) |
| Reverse Prayer Stretch | `st-reverse-prayer` | none | wrist extensors | carry, horizontal pull | 30 sec | Press the backs of the hands together with fingers pointing down and lift the elbows slightly. [src](https://thewell.northwell.edu/joint-health-orthopedics/wrist-exercises) |
| Kneeling Wrist Stretch (Fingers Back) | `st-kneeling-wrist-stretch` | none | wrist flexors, forearms | horizontal push, vertical push, core/midline | 30 sec | On hands and knees, turn the fingers to point toward the knees and gently lean back. [src](https://library.crossfit.com/free/pdf/08_03_Better_warmup.pdf) |
| Half-Kneeling Hip Flexor Stretch | `st-kneeling-hip-flexor` | none | hip flexors, quadriceps | lunge, squat, locomotion, jump | 30-60 sec/side | In a half-kneeling position, tuck the pelvis and shift forward until the front of the rear hip stretches. [src](https://www.acefitness.org/resources/everyone/exercise-library/142/kneeling-hip-flexor-stretch/) |
| Couch Stretch | `st-couch-stretch` | wall | hip flexors, quadriceps | lunge, squat, locomotion, jump | 60-90 sec/side | With the back knee near a wall or couch and the shin up it, step the other foot forward and lift the torso tall. [src](https://thetimerlab.com/hip-mobility-routine-timer/) |
| Low Lunge | `st-low-lunge` | none | hip flexors, quadriceps, groin | lunge, locomotion | 30-45 sec/side | Sink into a long lunge with the back knee down and arms overhead, keeping the pelvis tucked. [src](https://www.acefitness.org/resources/everyone/exercise-library/228/warrior-i/) |
| Pigeon Stretch | `st-pigeon` | none | glutes, hip external rotators, piriformis | squat, lunge, hinge, locomotion | 60-90 sec/side | With the front shin angled across the body and the back leg extended, lower the hips and fold forward. [src](https://thetimerlab.com/hip-mobility-routine-timer/) |
| 90/90 Hip Stretch | `st-9090-hip` | none | hip internal rotators, hip external rotators, glutes | squat, lunge, rotation | 60 sec/side | Sit with the front and back legs each bent 90 degrees and lean the torso over the front shin. [src](https://health.clevelandclinic.org/90-90-stretch) |
| Supine 90-90 Hip Rotator Stretch | `st-supine-9090` | none | glutes, piriformis | squat, hinge, lunge | 30 sec/side | Lying on your back with one ankle crossed on the opposite knee, draw the legs toward the chest. [src](https://www.acefitness.org/resources/everyone/exercise-library/148/supine-90-90-hip-rotator-stretch/) |
| Deep Squat Hold | `st-deep-squat-hold` | none | hips, adductors, ankles, low back | squat, full-body/olympic-style | 45-90 sec | Sit into the deepest comfortable squat with heels down and elbows gently pressing the knees out. [src](https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/) |
| Happy Baby | `st-happy-baby` | none | hips, adductors, low back | squat, hinge | 45-60 sec | On your back, hold the outside of the feet with knees bent toward the armpits and rock gently. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Standing Iliotibial Band Stretch | `st-standing-it-band` | wall | lateral hip, TFL, IT band | lunge, locomotion, jump | 30 sec/side | Stand beside a wall, cross the inside leg behind the outside leg, and lean the hip toward the wall. [src](https://orthoinfo.aaos.org/en/recovery/hip-conditioning-program/) |
| Supine Figure-Four Stretch | `st-figure-four` | none | glutes, piriformis | squat, hinge, lunge, locomotion | 30-60 sec/side | Lying on your back, cross one ankle over the opposite knee and pull the bottom thigh toward the chest. [src](https://www.acefitness.org/resources/everyone/exercise-library/148/supine-90-90-hip-rotator-stretch/) |
| Seated Figure-Four Stretch | `st-seated-figure-four` | none | glutes, piriformis | squat, hinge, locomotion | 30-45 sec/side | Sitting tall, cross one ankle over the opposite knee and hinge forward with a flat back. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |
| Knee-to-Opposite-Shoulder Stretch | `st-knee-to-opposite-shoulder` | none | glutes, piriformis | squat, hinge, lunge | 30 sec/side | Lying on your back, pull one bent knee toward the opposite shoulder. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |
| Single Knee-to-Chest | `st-single-knee-to-chest` | none | glutes, low back | hinge, squat | 30 sec/side | Lying on your back, hug one knee to the chest while the other leg stays relaxed. [src](https://orthoinfo.aaos.org/en/recovery/hip-conditioning-program/) |
| Double Knee-to-Chest | `st-double-knee-to-chest` | none | low back, glutes | hinge, squat, core/midline | 30-60 sec | Lying on your back, hug both knees to the chest and gently rock side to side. [src](https://orthoinfo.aaos.org/en/recovery/hip-conditioning-program/) |
| Supine Hamstring Stretch | `st-supine-hamstring` | none | hamstrings, calves | hinge, lunge, locomotion, full-body/olympic-style | 30-60 sec/side | Lying on your back, lift one straight leg and hold behind the thigh (or with a towel) until the back of the leg stretches. [src](https://www.acefitness.org/resources/everyone/exercise-library/235/supine-hamstrings-stretch/) |
| Seated Forward Fold | `st-seated-toe-touch` | none | hamstrings, low back, calves | hinge, full-body/olympic-style | 30-60 sec | Sit with legs straight and hinge from the hips to reach toward the toes with a long spine. [src](https://www.acefitness.org/resources/everyone/exercise-library/213/seated-toe-touches/) |
| Modified Hurdler's Stretch | `st-modified-hurdler` | none | hamstrings | hinge, locomotion, jump | 30 sec/side | Sit with one leg straight and the other foot against the inner thigh, and fold over the straight leg. [src](https://www.acefitness.org/resources/everyone/exercise-library/273/modified-hurdler-s-stretch/) |
| Half-Kneeling Hamstring Stretch | `st-half-kneeling-hamstring` | none | hamstrings, calves | hinge, locomotion, lunge | 30-45 sec/side | From half-kneeling, shift the hips back over the rear knee and straighten the front leg with toes up. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |
| Standing Forward Fold | `st-standing-forward-fold` | none | hamstrings, low back, calves | hinge, full-body/olympic-style, squat | 30-60 sec | Hinge forward with soft knees and let the torso hang, holding opposite elbows. [src](https://www.acefitness.org/resources/everyone/exercise-library/213/seated-toe-touches/) |
| Wall Hamstring Stretch | `st-wall-hamstring` | wall | hamstrings | hinge, locomotion | 30 sec/side | Lie near a doorway or wall with one heel up the wall and slowly straighten the knee. [src](https://www.mayoclinic.org/diseases-conditions/hamstring-injury/multimedia/hamstring-stretch/img-20006930) |
| Standing Quad Stretch | `st-standing-quad` | none | quadriceps, hip flexors | squat, lunge, locomotion, jump | 30 sec/side | Standing tall, hold one ankle behind you and pull the heel toward the glute with knees together. [src](https://barbend.com/quad-stretches/) |
| Side-Lying Quad Stretch | `st-side-lying-quad` | none | quadriceps, hip flexors | squat, lunge, locomotion | 30 sec/side | Lying on your side, hold the top ankle and pull the heel toward the glute, gently pressing the hip forward. [src](https://www.acefitness.org/resources/everyone/exercise-library/149/side-lying-quadriceps-stretch/) |
| Kneeling Quad Stretch | `st-kneeling-quad` | none | quadriceps, hip flexors | squat, lunge, jump | 30-45 sec/side | From half-kneeling, reach back to hold the rear foot and draw it toward the glute. [src](https://barbend.com/quad-stretches/) |
| Wall Calf Stretch (Straight Knee) | `st-wall-calf` | wall | calves, gastrocnemius | jump, locomotion, squat | 30-45 sec/side | Hands on a wall, step one leg back with heel down and knee straight, and lean forward. [src](https://orthoinfo.aaos.org/en/recovery/knee-conditioning-program/) |
| Wall Soleus Stretch (Bent Knee) | `st-wall-soleus` | wall | soleus, Achilles tendon | jump, locomotion, squat | 30-45 sec/side | In the wall calf position, bend the back knee while keeping the heel down to target the lower calf. [src](https://www.acefitness.org/resources/everyone/exercise-library/152/standing-dorsi-flexion-calf-stretch/) |
| Downward-Facing Dog | `st-downward-dog` | none | calves, hamstrings, shoulders | jump, hinge, vertical push, locomotion | 30-60 sec | From a plank, push the hips up and back into an inverted V, pressing the heels toward the floor. [src](https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/) |
| Step Calf Stretch | `st-step-calf` | step | calves, Achilles tendon | jump, locomotion | 30 sec/side | Stand with the ball of one foot on a step and slowly lower the heel below the step. [src](https://www.acefitness.org/resources/everyone/exercise-library/211/step-stretch/) |
| Seated Calf Stretch with Towel | `st-seated-calf-towel` | towel | calves | jump, locomotion | 30 sec/side | Sit with legs straight, loop a towel around the ball of one foot, and gently pull the toes toward you. [src](https://www.acefitness.org/resources/everyone/exercise-library/214/seated-calf-stretch/) |
| Kneeling Shin Stretch | `st-kneeling-shin` | none | tibialis anterior, ankles | jump, locomotion | 30-45 sec | Kneel with the tops of the feet flat on the floor and sit back onto the heels, lifting the knees slightly if comfortable. [src](https://www.acefitness.org/resources/everyone/exercise-library/195/kneeling-ta-stretch/) |
| Toe Sit | `st-toe-sit` | none | plantar fascia, toes, feet | jump, locomotion | 30-60 sec | Kneel with the toes tucked under and sit back on the heels. [src](https://barbend.com/ankle-mobility-exercises/) |
| Butterfly Stretch | `st-butterfly` | none | adductors, groin | squat, lunge | 30-60 sec | Sit with the soles of the feet together and knees out, and hinge forward with a long spine. [src](https://www.acefitness.org/resources/everyone/exercise-library/216/seated-butterfly-stretch/) |
| Frog Stretch | `st-frog` | none | adductors, groin, hips | squat, lunge | 45-90 sec | From hands and knees, slide the knees wide with shins parallel and ease the hips back. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Seated Straddle Stretch | `st-seated-straddle` | none | adductors, hamstrings | squat, hinge, lunge | 30-60 sec | Sit with legs wide and hinge forward from the hips, walking the hands out. [src](https://www.acefitness.org/resources/everyone/exercise-library/210/seated-straddle-stretch/) |
| Seated Side Straddle Stretch | `st-side-straddle` | none | adductors, hamstrings, lats | squat, lunge, rotation | 30 sec/side | In a wide seated straddle, reach toward one foot while keeping the chest open. [src](https://www.acefitness.org/resources/everyone/exercise-library/215/seated-straddle-with-side-reaches/) |
| Side Lunge Stretch | `st-side-lunge-hold` | none | adductors, groin | squat, lunge, locomotion | 30 sec/side | Shift into a side lunge with the straight leg's toes up and hold the bottom position. [src](https://www.acefitness.org/resources/everyone/exercise-library/50/side-lunge/) |

### mobility (7)

| Name | id | Equipment | Targets | Pairs with | Hold | Description |
|---|---|---|---|---|---|---|
| Neck Flexion and Extension | `st-neck-flexion-extension` | none | neck | carry, vertical push, full-body/olympic-style | 5-8 slow reps | Slowly lower the chin to the chest, then lift the gaze toward the ceiling, without forcing the range. [src](https://www.acefitness.org/resources/everyone/exercise-library/204/neck-flexion-and-extension/) |
| Chin Tucks | `st-chin-tuck` | none | neck, deep neck flexors | carry, horizontal push, vertical push | 10 x 3-sec hold | Glide the head straight back to make a double chin, hold briefly, and release. [src](https://www.acefitness.org/resources/everyone/exercise-library/205/shoulder-packing/) |
| Hip Controlled Articular Rotations | `st-hip-cars` | none | hips | squat, lunge, locomotion, rotation | 3-5 slow circles/direction/side | On hands and knees or standing, draw the biggest controlled circle possible with one knee while keeping the rest of the body still. [src](https://www.acefitness.org/resources/everyone/exercise-library/201/standing-gate-openers-frankensteins/) |
| Ankle Circles | `st-ankle-cars` | none | ankles | jump, locomotion, squat | 10 circles/direction/side | Seated or standing, draw slow, full circles with one foot while keeping the shin still. [src](https://barbend.com/ankle-mobility-exercises/) |
| Quadruped Adductor Rock-Back | `st-adductor-rockback` | none | adductors, hips | squat, lunge | 8-10 slow reps/side | On hands and knees with one leg out straight to the side, rock the hips back and forth. [src](https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/) |
| Slow Cat-Camel | `st-cat-camel-cooldown` | none | spine, low back | hinge, core/midline, full-body/olympic-style | 6-8 breaths | Move slowly between spinal flexion and extension on hands and knees, timing each with a slow breath. [src](https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/) |
| Supine Pelvic Tilts | `st-pelvic-tilt` | none | low back, abdominals | hinge, core/midline | 10-15 slow reps | Lying on your back with knees bent, gently flatten and then arch the low back. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |

### foam_roll_or_soft_tissue (11)

| Name | id | Equipment | Targets | Pairs with | Hold | Description |
|---|---|---|---|---|---|---|
| Foam Roller Thoracic Extension | `st-foam-roll-t-spine` | foam_roller | thoracic spine | vertical push, full-body/olympic-style, horizontal push | 5-8 reps at 2-3 levels | Lie with a roller under the upper back, hands behind the head, and extend back over it, moving it up a segment at a time. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Forearm Soft-Tissue Roll | `st-forearm-smash` | massage_ball | forearms | carry, horizontal pull, full-body/olympic-style | 60 sec/side | Roll the forearm slowly over a massage ball on a table, pausing on tender spots. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Foam Roll Quadriceps | `st-roll-quads` | foam_roller | quadriceps, hip flexors | squat, lunge, jump, locomotion | 60-90 sec/side | Lying face down with the roller under the thighs, roll slowly from hip to just above the knee, pausing on tender spots. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Foam Roll Lateral Thigh | `st-roll-it-band` | foam_roller | lateral thigh, TFL | lunge, locomotion, jump | 60 sec/side | Lie on your side on the roller and roll slowly between the hip and knee, supporting with the top leg. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Foam Roll Calves | `st-roll-calves` | foam_roller | calves | jump, locomotion | 60 sec/side | Sit with the roller under the calves and roll from ankle to knee, crossing one leg over for more pressure. [src](https://www.nasm.org/resource-center/exercise-library/foam-roll-calves) |
| Foam Roll Lats | `st-roll-lats` | foam_roller | lats | vertical push, vertical pull, horizontal pull, full-body/olympic-style | 60 sec/side | Lie on your side with the arm overhead and the roller under the armpit area, rolling slowly along the side of the back. [src](https://www.nasm.org/resource-center/exercise-library/foam-roll-latissimus-dorsi) |
| Foam Roll Adductors | `st-roll-adductors` | foam_roller | adductors | squat, lunge | 60 sec/side | Lie face down with one leg out to the side and the roller under the inner thigh, rolling from knee to groin. [src](https://www.nasm.org/resource-center/exercise-library/foam-roll-adductors) |
| Foam Roll Glutes | `st-roll-glutes` | foam_roller | glutes, piriformis | squat, hinge, lunge | 60 sec/side | Sit on the roller with one ankle crossed over the opposite knee and lean into the crossed-leg glute. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Foam Roll Hamstrings | `st-roll-hamstrings` | foam_roller | hamstrings | hinge, locomotion | 60 sec/side | Sit with the roller under the hamstrings and roll from just above the knee to the glute. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Massage Ball Pec Release | `st-ball-pec` | massage_ball | chest, anterior shoulder | horizontal push, vertical push | 60 sec/side | Pin a massage ball between the chest and a wall below the collarbone and move the arm slowly. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |
| Massage Ball Foot Roll | `st-ball-foot` | massage_ball | feet, plantar fascia | jump, locomotion | 60 sec/side | Roll the sole of the foot slowly over a massage ball from heel to toes. [src](https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide) |

### breathing/downregulation (7)

| Name | id | Equipment | Targets | Pairs with | Hold | Description |
|---|---|---|---|---|---|---|
| Box Breathing | `st-box-breathing` | none | nervous system, diaphragm | squat, hinge, lunge, horizontal push, vertical push, horizontal pull, vertical pull, carry, core/midline, jump, locomotion, full-body/olympic-style, rotation | 2-5 min | Inhale for 4 counts, hold for 4, exhale for 4, and hold for 4, repeating calmly. [src](https://health.clevelandclinic.org/box-breathing-benefits) |
| Supine Diaphragmatic Breathing | `st-diaphragmatic-breathing` | none | diaphragm, nervous system | squat, hinge, lunge, horizontal push, vertical push, horizontal pull, vertical pull, carry, core/midline, jump, locomotion, full-body/olympic-style, rotation | 2-5 min | Lie on your back with knees bent, one hand on the chest and one on the belly, and breathe so only the belly hand rises. [src](https://my.clevelandclinic.org/health/articles/9445-diaphragmatic-breathing) |
| Crocodile Breathing | `st-crocodile-breathing` | none | diaphragm, low back | hinge, core/midline, carry | 2-3 min | Lie face down with the forehead on the hands and breathe into the belly so the low back rises and falls. [src](https://my.clevelandclinic.org/health/articles/9445-diaphragmatic-breathing) |
| 4-7-8 Breathing | `st-478-breathing` | none | nervous system | squat, hinge, lunge, horizontal push, vertical push, horizontal pull, vertical pull, carry, core/midline, jump, locomotion, full-body/olympic-style, rotation | 4 cycles | Inhale through the nose for 4 counts, hold for 7, and exhale fully through the mouth for 8. [src](https://health.clevelandclinic.org/4-7-8-breathing) |
| Cyclic Sighing | `st-cyclic-sighing` | none | nervous system, diaphragm | squat, hinge, lunge, horizontal push, vertical push, horizontal pull, vertical pull, carry, core/midline, jump, locomotion, full-body/olympic-style, rotation | 3-5 min | Take a full inhale through the nose, a second short top-up inhale, then a long slow exhale through the mouth; repeat. [src](https://pubmed.ncbi.nlm.nih.gov/36630953/) |
| Legs Up the Wall | `st-legs-up-wall` | wall | hamstrings, low back, nervous system | locomotion, jump, lunge, squat | 3-5 min | Lie on your back with the hips near a wall and the legs resting up it, breathing slowly. [src](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848) |
| 90/90 Wall Breathing | `st-9090-breathing` | wall | diaphragm, low back, hamstrings | hinge, core/midline, squat | 5 slow breaths x 2-3 | Lie on your back with hips and knees at 90 degrees and feet on a wall, tuck the pelvis slightly, and take slow full exhales. [src](https://my.clevelandclinic.org/health/articles/9445-diaphragmatic-breathing) |

## Decisions and caveats

- **Box-dependent jumps** (box jump, box jump-over, burpee box jump-over, depth drop/jump, seated box jump) and box step-ups are included but tagged `equipment: ["box"]` so they drop out automatically. Every one lists a no-box scaling option (squat jump, lateral line hop, burpee, step-up → reverse lunge). "Step-up" items need a box/bench/stair, so they carry `box` too.
- **Jump-overs** use a line, a dumbbell on its side, or another low object (Street Parking's standard substitute for jump rope). Line versions have `[]`; the dumbbell-obstacle version lists `dumbbell`.
- **Running/walking** are listed under `bodyweight` (modality monostructural, pattern locomotion) since they need no gear. Use them as the rope/cardio alternative.
- **Penguin jumps** are listed under `jump_rope` (a no-rope DU substitute) with `equipment: []`; a separate prep version lives in warm-ups.
- **Bench-required DB moves** (bench press, incline press, hip thrust, Bulgarian split squat) are kept but flagged `bench`/`adjustable_bench`; each has a floor alternative (floor press, glute bridge, split squat).
- Kettlebell, barbell, pull-up bar, rings, rower, bike, wall ball, and sandbag movements are excluded. DB swing and DB windmill/TGU are dumbbell versions of moves often done with a kettlebell.
- `vertical pull` is thin (no pull-up bar). Only DB high pull, upright row, and pullover qualify, so pull work leans on horizontal rows.
- Source URLs: per item where a specific page existed (CrossFit Essentials, ACE Exercise Library, BarBend, AAOS OrthoInfo, NASM, Cleveland Clinic); otherwise a category-level reference (Street Parking libraries, the CrossFit Dumbbell Training Guide, the ACE equipment index, the RAMP warm-up paper, the Mayo Clinic stretching guide). Mayo Clinic pages block automated fetches (HTTP 403) but are live in a browser.

## Sources

### www.acefitness.org

- https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/100/side-plank-modified/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/109/dirty-dog/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/110/hip-rotations-push-up-position/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/114/single-leg-stand-with-reaches/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/12/bent-over-row/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/127/single-arm-single-leg-romanian-dead-lift/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/136/single-leg-squat/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/140/lunge-with-elbow-instep/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/141/kneeling-lat-stretch-w-bench/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/142/kneeling-hip-flexor-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/143/lunge-with-overhead-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/ (4 items)
- https://www.acefitness.org/resources/everyone/exercise-library/148/supine-90-90-hip-rotator-stretch/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/149/side-lying-quadriceps-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/150/bear-crawl/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/152/standing-dorsi-flexion-calf-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/16/cobra/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/174/overhead-triceps-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/176/jump-and-reach/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/177/forward-linear-jumps/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/181/lateral-shuffles/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/19/chest-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/195/kneeling-ta-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/199/standing-shoulder-extension/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/201/standing-gate-openers-frankensteins/ (3 items)
- https://www.acefitness.org/resources/everyone/exercise-library/202/lateral-neck-flexion/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/204/neck-flexion-and-extension/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/205/shoulder-packing/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/206/lateral-over-unders/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/207/hexagon-drill/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/208/seated-bent-knee-biceps-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/209/standing-chest-stretch/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/21/lying-chest-fly/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/210/seated-straddle-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/211/step-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/213/seated-toe-touches/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/214/seated-calf-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/215/seated-straddle-with-side-reaches/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/216/seated-butterfly-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/221/forward-hurdle-run/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/223/side-lying-arm-rolls/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/224/standing-ankle-mobilization/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/227/childs-pose/ (3 items)
- https://www.acefitness.org/resources/everyone/exercise-library/228/warrior-i/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/229/supine-spinal-twist-with-rib-grab-and-progressions/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/230/single-leg-push-off/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/234/cycled-split-squat-jump/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/235/supine-hamstrings-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/244/upward-facing-dog/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/246/alternate-leg-push-off/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/247/spider-walks/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/249/prone-scapular-shoulder-stabilization-series-i-y-t-w-o-formation/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/258/mountain-climbers/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/259/ckc-parascapular-exercises/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/26/lateral-raise/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/270/quadruped-bent-knee-hip-extensions/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/273/modified-hurdler-s-stretch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/28/step-up/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/303/side-plank/ (3 items)
- https://www.acefitness.org/resources/everyone/exercise-library/306/burpee/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/319/reverse-lunge/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/320/plank-ups/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/327/push-up-with-staggered-hands/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/328/lateral-crawls/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/33/hip-hinge/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/330/high-plank-t-spine-rotation/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/347/lateral-lunge-wood-chop/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/352/rotator-cuff-external-rotation/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/353/reverse-fly/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/356/offset-single-arm-chest-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/358/suitcase-carry/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/360/reverse-lunge-with-rotation/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/361/squat-to-overhead-raise/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/ (3 items)
- https://www.acefitness.org/resources/everyone/exercise-library/363/lunge/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/364/lateral-lunge/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/365/transverse-lunge/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/366/bulgarian-split-squat/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/367/elevated-glute-bridge/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/38/side-lying-hip-abduction/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/381/half-turkish-get-up/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/383/clean-and-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/386/high-windmill/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/392/single-arm-swing/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/394/halo/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/395/single-arm-overhead-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/49/glute-bridge/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/50/side-lunge/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/51/calf-raises/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/52/crunch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/54/front-raise/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/65/russian-twist/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/70/bicep-curl/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/71/standing-shoulder-press/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/72/shrug/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/73/standing-calf-raises-wall/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/74/triceps-extension/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/76/reverse-crunch/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/8/forward-lunge/ (1 items)
- https://www.acefitness.org/resources/everyone/exercise-library/9/supermans/ (2 items)
- https://www.acefitness.org/resources/everyone/exercise-library/equipment/dumbbells/ (3 items)
- https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/ (18 items)

### barbend.com

- https://barbend.com/ankle-mobility-exercises/ (3 items)
- https://barbend.com/arnold-press/ (1 items)
- https://barbend.com/bear-crawl/ (1 items)
- https://barbend.com/best-dumbbell-exercises/ (4 items)
- https://barbend.com/best-plyometric-exercises/ (20 items)
- https://barbend.com/bulgarian-split-squat/ (1 items)
- https://barbend.com/burpee-variations/ (4 items)
- https://barbend.com/cossack-squat/ (2 items)
- https://barbend.com/curtsy-lunge/ (2 items)
- https://barbend.com/devils-press/ (1 items)
- https://barbend.com/dumbbell-pullover/ (1 items)
- https://barbend.com/dumbbell-row/ (1 items)
- https://barbend.com/dumbbell-snatch/ (1 items)
- https://barbend.com/dumbbell-thruster/ (1 items)
- https://barbend.com/floor-press/ (1 items)
- https://barbend.com/hollow-hold/ (4 items)
- https://barbend.com/mountain-climbers/ (1 items)
- https://barbend.com/push-up-variations/ (7 items)
- https://barbend.com/quad-stretches/ (3 items)
- https://barbend.com/renegade-row/ (1 items)
- https://barbend.com/rucking/ (1 items)
- https://barbend.com/single-leg-romanian-deadlift/ (1 items)
- https://barbend.com/tuck-jumps/ (1 items)
- https://barbend.com/z-press/ (1 items)

### www.crossfit.com

- https://www.crossfit.com/essentials/dumbbell-overhead-walking-lunge (1 items)
- https://www.crossfit.com/essentials/freestanding-handstand (1 items)
- https://www.crossfit.com/essentials/handstand-push-up-variations (2 items)
- https://www.crossfit.com/essentials/purpose-of-the-general-warm-up (3 items)
- https://www.crossfit.com/essentials/the-abmat-sit-up (2 items)
- https://www.crossfit.com/essentials/the-air-squat (2 items)
- https://www.crossfit.com/essentials/the-box-jump (2 items)
- https://www.crossfit.com/essentials/the-box-step-up (2 items)
- https://www.crossfit.com/essentials/the-burpee-2 (2 items)
- https://www.crossfit.com/essentials/the-burpee-box-jump-over (1 items)
- https://www.crossfit.com/essentials/the-dip (1 items)
- https://www.crossfit.com/essentials/the-double-under (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-clean (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-deadlift (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-front-rack-lunge (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-front-squat (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-hang-clean (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-hang-power-clean (2 items)
- https://www.crossfit.com/essentials/the-dumbbell-overhead-squat (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-power-clean (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-power-snatch (6 items)
- https://www.crossfit.com/essentials/the-dumbbell-push-jerk (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-push-press (3 items)
- https://www.crossfit.com/essentials/the-dumbbell-snatch (2 items)
- https://www.crossfit.com/essentials/the-dumbbell-thruster (1 items)
- https://www.crossfit.com/essentials/the-dumbbell-turkish-get-up (2 items)
- https://www.crossfit.com/essentials/the-farmer-carry (2 items)
- https://www.crossfit.com/essentials/the-good-morning (1 items)
- https://www.crossfit.com/essentials/the-handstand-walk (1 items)
- https://www.crossfit.com/essentials/the-kipping-handstand-push-up (1 items)
- https://www.crossfit.com/essentials/the-l-sit (1 items)
- https://www.crossfit.com/essentials/the-push-up (3 items)
- https://www.crossfit.com/essentials/the-single-leg-squat (1 items)
- https://www.crossfit.com/essentials/the-single-under (1 items)
- https://www.crossfit.com/essentials/the-strict-handstand-push-up (1 items)
- https://www.crossfit.com/essentials/the-sumo-deadlift-high-pull (1 items)
- https://www.crossfit.com/essentials/the-walking-lunge (1 items)
- https://www.crossfit.com/essentials/the-wall-walk (1 items)
- https://www.crossfit.com/essentials/the-windshield-wiper (1 items)

### spmembersonly.com

- https://spmembersonly.com/no-equipment (7 items)
- https://spmembersonly.com/pp-movement-library (8 items)

### www.scottishathletics.org.uk

- https://www.scottishathletics.org.uk/wp-content/uploads/2014/04/Warm-up-revisted-.pdf (15 items)

### assets.crossfit.com

- https://assets.crossfit.com/pdfs/seminars/Dumbbell_Training_Guide.pdf (12 items)

### www.nasm.org

- https://www.nasm.org/resource-center/blog/recovery/foam-rolling-and-self-myofascial-release-the-trainer-application-guide (8 items)
- https://www.nasm.org/resource-center/exercise-library/foam-roll-adductors (1 items)
- https://www.nasm.org/resource-center/exercise-library/foam-roll-calves (1 items)
- https://www.nasm.org/resource-center/exercise-library/foam-roll-latissimus-dorsi (1 items)

### www.mayoclinic.org

- https://www.mayoclinic.org/diseases-conditions/hamstring-injury/multimedia/hamstring-stretch/img-20006930 (1 items)
- https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848 (7 items)

### streetparking.com

- https://streetparking.com/blogs/news/7-workouts-you-can-do-with-no-equipment (7 items)

### www.issaonline.com

- https://www.issaonline.com/blogs/strength/issa-or-beginner-guide-to-rucking-and-weighted-vest-training (7 items)

### orthoinfo.aaos.org

- https://orthoinfo.aaos.org/en/recovery/hip-conditioning-program/ (4 items)
- https://orthoinfo.aaos.org/en/recovery/knee-conditioning-program/ (1 items)
- https://orthoinfo.aaos.org/en/recovery/rotator-cuff-and-shoulder-conditioning-program/ (2 items)

### elitejumps.co

- https://elitejumps.co/blogs/guides/ultimate-beginner-jump-rope-guide (6 items)

### health.clevelandclinic.org

- https://health.clevelandclinic.org/4-7-8-breathing (1 items)
- https://health.clevelandclinic.org/90-90-stretch (2 items)
- https://health.clevelandclinic.org/box-breathing-benefits (1 items)
- https://health.clevelandclinic.org/wrist-pain-exercises (2 items)

### doperopes.co.uk

- https://doperopes.co.uk/pages/jump-rope-training-footwork-series (4 items)

### www.jumpropedudes.com

- https://www.jumpropedudes.com/blog/easy-jump-rope-tricks/ (4 items)

### wodprep.com

- https://wodprep.com/blog/beginner-progression-double-unders/ (4 items)

### movekit.com

- https://movekit.com/exercises/snap-down-landing (4 items)

### www.crossrope.com

- https://www.crossrope.com/blogs/blog/how-to-do-double-unders/ (3 items)

### www.muscleandfitness.com

- https://www.muscleandfitness.com/muscle-fitness-hers/hers-workouts/8-plyometrics-exercises-you-can-do-without-gym/ (3 items)

### my.clevelandclinic.org

- https://my.clevelandclinic.org/health/articles/9445-diaphragmatic-breathing (3 items)

### www.elevaterope.com

- https://www.elevaterope.com/blogs/jump-rope-tricks-freestyle/jump-rope-trick-names-glossary (2 items)

### beginnerfitpath.com

- https://beginnerfitpath.com/weighted-vest-training/ (2 items)

### library.crossfit.com

- https://library.crossfit.com/free/pdf/08_03_Better_warmup.pdf (2 items)

### library.theprehabguys.com

- https://library.theprehabguys.com/vimeo-video/neck-stretch/ (2 items)

### thewell.northwell.edu

- https://thewell.northwell.edu/joint-health-orthopedics/wrist-exercises (2 items)

### thetimerlab.com

- https://thetimerlab.com/hip-mobility-routine-timer/ (2 items)

### fitness.mtntactical.com

- https://fitness.mtntactical.com/exercises/details.php?id=renegade-man-maker (1 items)

### pubmed.ncbi.nlm.nih.gov

- https://pubmed.ncbi.nlm.nih.gov/36630953/ (1 items)

Additional research references consulted: CrossFit movement index https://www.crossfit.com/crossfit-movements; CrossFit FAQ on exercise standards https://www.crossfit.com/faq/exercises; Street Parking program overview https://streetparking.com/pages/program; UKSCA RAMP article https://www.uksca.org.uk/uksca-iq/article/85/warm-up-revisited-the-ramp-method-of-optimising-performance-preparation; Mayhem Athlete https://www.mayhemathlete.com/ and PRVN https://www.prvnfitness.com/ (program sites, used for naming conventions only).
