# 天使的策略

地下設施風格的數字心理戰小遊戲（原創玩法，沒有電腦對手）。

- **單機闖關**：五段難度（幼幼／簡單／普通／困難／神話）各 50 關，每 10 關一場魔王關；六種題型：推理、算式、湊近值、找規則、天平配重、算式金字塔。
- **每日挑戰**：台北時間切日，每天四種題型各一題。
- **線上多人**：2–6 位真人。數字博弈、時間拍賣、大或小、移除一個，加上各種搶答題；賽制可選籌碼生存／淘汰／固定回合積分。支援邀請連結、觀戰與大廳聊天室。
- 每一題結束都有附標註的解法圖與完整算式。

## 本機執行

```bash
npm ci
npm start          # http://localhost:3110（Windows 可直接雙擊「啟動遊戲.bat」）
npm run verify     # 規則、題型與線上引擎測試
```

同一個 Wi-Fi 的手機／平板可連啟動訊息列出的區域網路網址。

## 部署

前端放 GitHub Pages，伺服器放 Render（新加坡）。

1. 在 Render 以 `render.yaml` 建立服務，設定 `GAME_ALLOWED_ORIGIN` 為 Pages 網址。
2. 在 GitHub 專案 Settings → Variables 新增 `GAME_SERVER_URL`（Render 的 https 網址）。
3. 推送到 `main`，`.github/workflows/pages.yml` 會測試、注入伺服器網址並發佈前端。

伺服器網址只有一個入口：`GAME_SERVER_URL`（`public/js/server-url.js`，由 `scripts/inject-config.js` 於建置時寫入）。
