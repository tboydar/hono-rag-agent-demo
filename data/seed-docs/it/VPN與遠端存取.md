# VPN 與遠端存取

## 適用範圍

存取內部系統（HR 系統、KB、內部 GitLab、staging 環境）必須透過公司 VPN。公司 VPN 使用 WireGuard 協定。

## 申請 VPN 帳號

1. 在 IT 工單系統建立「VPN 帳號申請」工單（類別：存取權限）
2. 工單需經直屬主管核准
3. IT 會在 1 個工作天內建立帳號並寄送設定檔（.conf）與 QR code 至公司信箱

## 設定步驟（macOS / Windows）

1. 安裝 WireGuard 官方客戶端
2. 匯入 IT 提供的 .conf 設定檔，或掃描 QR code
3. 啟用 tunnel「yaosen-office」
4. 驗證：瀏覽器開啟 https://kb.yaosen.internal 能開啟即成功

## 設定步驟（手機）

使用 WireGuard App 掃描 QR code 即可。手機 VPN 僅供查閱 KB 與收發公司信件使用。

## 常見問題

- 連不上：先確認設定檔未過期（憑證效期 1 年），再檢查本地防火牆是否擋 UDP 51820
- 連上但無法開內網：DNS 被本機覆寫，將 DNS 改為「僅 tunnel DNS」
- 憑證過期：工單申請重新簽發，舊憑證會立即失效

## 安全規範

- VPN 設定檔含私鑰，禁止上傳至任何雲端空間或通訊軟體
- 公共 Wi-Fi 環境下存取公司資源一律需開啟 VPN
- 離職當日 VPN 帳號自動失效
