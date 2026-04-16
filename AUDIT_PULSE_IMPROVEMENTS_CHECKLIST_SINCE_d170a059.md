# Checklist audit — Pulse improvements since `d170a0596d958ae4466725b2b91dccbe8d4408eb`

Date: 2026-04-17

## Scope

Checklist này tổng hợp lại audit từ:

- `DE_XUAT_IMPROVEMENT_CHO_PULSE_PLUGIN.md`
- `PLAN.en.md`
- `PLAN.md`
- các commit từ `d170a0596d958ae4466725b2b91dccbe8d4408eb..HEAD`

Reviewed commits:

- `352fdfb` — add human-readable handoff companions
- `3550de0` — add checkpoint-aware resume scouting
- `1a088b9` — add checkpoint command workflows
- `57af46f` — harden checkpoint save validation
- `61cf3a0` — add targeted recall and memory hygiene
- `5bb5299` — polish verification evidence lifecycle
- `6c7e222` — refresh repo-local onboarding assets

---

## Executive summary checklist

- [x] Direction tổng thể của đợt improvement là đúng.
- [x] Repo đã có tiến bộ rõ ở handoff UX, checkpoint v1, targeted recall, memory hygiene, verification lifecycle.
- [x] Initiative đã complete các gap chính của proposal/plan trong execution slice này; phần còn lại chủ yếu là maturity evolution, không còn missing capability cốt lõi.
- [x] `current-feature.json` và `runtime-snapshot.json` đã trở thành live control-plane artifacts được runtime duy trì.
- [x] Docs và runtime contracts quan trọng đã được align lại.
- [x] Wave-1 docs đã được hoàn tất, bao gồm cả `README.md`.

---

## 1) Checklist theo theme

## Theme A — Docs clarity

### Done
- [x] `AGENTS.md` đã có section **What Pulse Is / Is Not** (`AGENTS.md:9`).
- [x] `AGENTS.md` đã có **One-Line Glossary** (`AGENTS.md:23`).
- [x] `AGENTS.md` đã docs hóa **3-plane model** (`AGENTS.md:77`).
- [x] `using-pulse` đã đóng vai trò scout/router rõ hơn (`plugins/pulse/skills/using-pulse/SKILL.md:84`, `:149`, `:282`).

### Partial / Missing
- [x] `README.md` đã phản ánh wave docs clarity sau các update tiếp theo.
- [x] Top-level README đã docs hóa các operator surfaces mới như checkpoint flows, recall pack, current-feature/runtime snapshot reality.
- [x] Whole feature / current phase / bead framing đã được reinforce tốt hơn ở các bề mặt docs chính.

### Verdict
- **Status:** Done

---

## Theme B — 3-plane artifact model

### Done
- [x] Memory plane `.pulse/memory/` đã được dùng như root trong nhiều skill contracts.
- [x] `AGENTS.md` và `README.md` đã mô tả 3-plane model.
- [x] Active verification lifecycle đã bắt đầu chuyển khỏi model cũ sang runtime plane + feature record plane.

### Partial / Missing
- [x] Control plane đã complete hơn vì `current-feature.json` và `runtime-snapshot.json` được duy trì như live artifacts.
- [x] `history/<feature>/` giờ đã có lifecycle-summary contract + promoted artifact expectations, đồng thời scout/runtime đã surface `history_lifecycle.self_sufficient` để chứng minh khi nào history plane đủ tự reconstruct feature-level lifecycle cho audit/onboarding mà không cần dựa vào live `.pulse/` mirrors.
- [x] Runtime checkpoint link inference đã bỏ legacy verification fallback cũ; giờ prefer active `.pulse/runs/<feature>/verification/` rồi promoted `history/<feature>/verification/`.

### Verdict
- **Status:** Done

---

## Theme C — Handoff / resume productization

### Done
- [x] Handoff contract đã mạnh hơn trong `plugins/pulse/skills/using-pulse/references/handoff-contract.md:248`.
- [x] Có human-readable companion concepts, resume briefing, transfer block.
- [x] `using-pulse` đã present active handoffs theo format operator-friendly hơn (`plugins/pulse/skills/using-pulse/SKILL.md:295`).
- [x] Checkpoints được định nghĩa là advisory, không override authoritative state/handoff.

### Partial / Missing
- [x] Companion formats đã được reclassified thành canonical rendered companions trong shared contract + using-pulse surfaces.
- [x] Đã có shared renderer path trong runtime/status surfaces để generate handoff summary / resume briefing / transfer block từ authoritative JSON.
- [x] Handoff productization giờ đã được kéo rộng sang planning/swarming/executing/reviewing/validating với shared contract và checkpoint pause-boundary guidance nhất quán hơn, không còn tập trung gần như chỉ ở `using-pulse`.

### Verdict
- **Status:** Done

---

## Theme D — Unified operator surface

### Done
- [x] `pulse_status` đã mạnh hơn nhiều như một read-only scout.
- [x] Scout status payload đã surface: `current_feature`, `runtime_snapshot`, `handoff_manifest`, `checkpoints`, `memory_recall`, `history_lifecycle` (`plugins/pulse/skills/using-pulse/scripts/pulse_state.mjs`).
- [x] Checkpoint CLI flows tồn tại thật qua `pulse_status.mjs checkpoint <...>`.

### Partial / Missing
- [x] `current-feature.json` đã vượt mức supported read contract và trở thành live surface được sync.
- [x] `runtime-snapshot.json` cũng đã trở thành live surface được sync.
- [x] Đã có authoritative write/update lifecycle cho hai artifact này trong repo flow thực.
- [x] Operator surface đã được operationalize mạnh hơn đáng kể ở reading/scouting và sync lifecycle.

### Verdict
- **Status:** Done

---

## Theme E — Practical memory recall

### Done
- [x] Memory roots cho `critical-patterns`, `learnings`, `corrections`, `ratchet` đã tồn tại trong state helper (`plugins/pulse/skills/using-pulse/scripts/pulse_state.mjs:301-306`).
- [x] Recall pack selection đã tồn tại (`.../pulse_state.mjs:736` vùng recall).
- [x] Memory hygiene warnings đã tồn tại (`.../pulse_state.mjs:659`).
- [x] `planning`, `debugging`, `reviewing`, `compounding`, `validating` đã reflect root mới `.pulse/memory/` theo nhiều mức độ.

### Partial / Missing
- [x] Recall đã tiến lên metadata-first schema-scored selection với schema-strength surfacing, field completeness hygiene, explicit fallback boundary, và `schema_summary` trong scout/runtime surface; không còn chỉ là heuristic/lightweight recall đơn thuần.
- [x] `corrections` / `ratchet` / learning metadata đã được tighten đáng kể qua template/contracts mới và metadata fields rõ hơn cho recall/hygiene.
- [x] Docs language overclaim quan trọng về recall/control-plane đã được giảm bớt và chỉnh lại theo repo reality.

### Verdict
- **Status:** Strong metadata-first v1

---

## Theme F — Checkpoints as freeze-frames

### Done
- [x] Có support cho `save`, `list`, `show`, `diff`, `resume-brief` trong `plugins/pulse/skills/using-pulse/scripts/pulse_status.mjs:35`.
- [x] Checkpoint record build/save/read logic đã tồn tại trong `plugins/pulse/skills/using-pulse/scripts/pulse_state.mjs`.
- [x] Validation path cho checkpoint inputs đã được harden (`.../pulse_state.mjs:378`).
- [x] `checkpointSave` từ chối save khi không có active feature (`.../pulse_state.mjs:852`).
- [x] Thiết kế vẫn đúng triết lý advisory snapshot, không biến thành restore engine.

### Partial / Missing
- [x] Trigger/update conventions cho checkpoint đã được productize tốt hơn qua planning/swarming/executing/reviewing guidance ở các phase/gate/pause boundaries.
- [x] Checkpoint discovery đã có explicit feature targeting qua checkpoint CLI/options, không còn chỉ phụ thuộc vào active feature derivation.

### Verdict
- **Status:** Done

---

## Theme G — Verification lifecycle cleanup

### Done
- [x] `executing` dùng active evidence path mới (`plugins/pulse/skills/executing/SKILL.md:142`).
- [x] `planning` bead guidance đã dùng path mới (`plugins/pulse/skills/planning/SKILL.md:585`).
- [x] `reviewing` đã phân biệt active evidence và promoted durable evidence (`plugins/pulse/skills/reviewing/SKILL.md:216`).
- [x] `compounding` đã prefer `history/<feature>/verification/` và fallback đúng chỗ (`plugins/pulse/skills/compounding/SKILL.md:72`).

### Partial / Missing
- [x] `AGENTS.md` đã được cập nhật sang verification lifecycle mới.
- [x] `CLAUDE.md` đã được cập nhật sang verification lifecycle mới.
- [x] Runtime logic đã bỏ legacy fallback path cũ trong `plugins/pulse/skills/using-pulse/scripts/pulse_state.mjs`.

### Verdict
- **Status:** Done

---

## 2) Concrete issue checklist

### High severity
- [x] `AGENTS.md` đã được cập nhật khỏi `.pulse/verification/` sang lifecycle mới.
- [x] `CLAUDE.md` đã được cập nhật khỏi `.pulse/verification/<feature>/*.md` sang lifecycle mới.
- [x] `current-feature.json` đã có operational lifecycle thật.
- [x] `runtime-snapshot.json` đã có operational lifecycle thật.

### Medium severity
- [x] `README.md` đã được update để phản ánh repo reality hiện tại.
- [x] Runtime logic không còn fallback về evidence path cũ; migration boundary sạch hơn rõ rệt.
- [x] Handoff companion prose đã bớt drift risk đáng kể vì runtime render từ authoritative JSON thay vì chỉ dựa vào prose conventions.

### Low / Medium severity
- [x] Docs về memory recall đã gần hơn với repo reality sau khi runtime/status surfaces nêu rõ metadata-first ranking, schema strength, `schema_summary`, hygiene warnings, và fallback boundary.

---

## 3) Proposal accuracy checklist

### Những điểm proposal đúng
- [x] Không copy Maestro nguyên xi.
- [x] 3-plane model là đúng hướng.
- [x] Checkpoint nên bắt đầu ở advisory immutable snapshot, không restore engine.
- [x] Verification nên tách active evidence và promoted durable evidence.
- [x] Memory recall nên đi theo hướng practical/lightweight trước.

### Những điểm proposal đang đi trước repo reality
- [x] Proposal về `current-feature.json` và `runtime-snapshot.json` giờ đã gần hơn với repo reality vì hai artifact này đã là first-class runtime surfaces.
- [x] Proposal về memory recall nay đã gần hơn với repo reality vì implementation đã có metadata-first schema scoring, schema-strength surfacing, `schema_summary`, và hygiene/fallback boundaries rõ hơn.
- [x] Proposal về handoff productization nay đã gần hơn với repo reality vì shared contract đã được kéo rộng qua planning/swarming/executing/reviewing/validating, không còn chủ yếu nằm ở `using-pulse`.

### Verdict
- **Status:** Strategically sound and now substantially operationalized

---

## 4) Plan accuracy checklist

### Những phần plan vẫn đúng
- [x] Checkpoint v1 advisory-only là đúng.
- [x] Targeted recall + hygiene là hướng đúng cho v1.
- [x] Verification split active/durable là đúng.
- [x] Handoff companion surfaces là đúng.

### Những phần plan giờ đã outdated hoặc quá optimistic
- [x] Các mục coi `.pulse/current-feature.json` và `.pulse/runtime-snapshot.json` là stable operator-state surfaces giờ đã gần đúng hơn nhiều.
- [x] Wave-1 docs scope nay đã khớp repo reality tốt hơn vì README đã được cập nhật sau audit.

### Verdict
- **Status:** Useful roadmap with the major planned gaps now operationalized
---

## 5) Action checklist theo ưu tiên

## P1 — nên làm ngay
- [x] Sửa stale verification path trong `AGENTS.md`.
- [x] Sửa stale verification path trong `CLAUDE.md`.
- [x] Chỉnh docs language để không overclaim `current-feature.json` và `runtime-snapshot.json` như thể chúng chưa live.

## P2 — khoảng trống kiến trúc quan trọng nhất
- [x] Thêm authoritative writer(s) cho `.pulse/current-feature.json`.
- [x] Thêm authoritative writer(s) cho `.pulse/runtime-snapshot.json`.
- [x] Định nghĩa update triggers rõ cho hai artifact trên.
- [x] Định nghĩa source precedence rõ giữa `state.json`, `STATE.md`, `current-feature.json`, `runtime-snapshot.json`.
- [x] Hoàn tất README wave để top-level docs bắt kịp runtime reality.
- [x] Đã chuẩn hóa handoff companion generation bằng shared renderer/contract chung.

## P3 — cải thiện độ chặt và maintainability
- [x] Tighten schema cho `corrections`.
- [x] Tighten schema cho `ratchet`.
- [x] Tighten metadata cho learnings dùng bởi recall/hygiene.
- [x] Đã giảm hẳn dependence vào legacy verification fallback ở runtime checkpoint links.

---

## 6) Recommended next execution slice

- [x] Fix stale docs/instructions first (`AGENTS.md`, `CLAUDE.md`).
- [x] Operationalize `current-feature.json` và `runtime-snapshot.json` thành live runtime artifacts.
- [x] Update `README.md` để phản ánh current repo behavior.
- [x] Đã standardize handoff companion rendering sau khi control-plane surfaces ổn định hơn.

---

## 7) Final verdict checklist

- [x] Pulse đang đi đúng hướng.
- [x] Đợt improvement này đã tạo ra value thật.
- [x] Checkpoint v1 là workstream hoàn thiện nhất ở đợt này.
- [x] Verification lifecycle cleanup là cải tiến đúng bản chất.
- [x] Targeted recall và hygiene là một practical v1 tốt.
- [x] History plane, recall layer, và handoff productization đều đã có runtime/doc/test evidence đủ mạnh để đóng các transitional gaps chính của execution slice này.
- [x] Control plane đã tiến tới trạng thái hoàn chỉnh hơn vì `current-feature.json` và `runtime-snapshot.json` là live maintained artifacts.
