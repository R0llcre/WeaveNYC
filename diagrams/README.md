# WeaveNYC — Diagrams

所有架构图使用 [Mermaid](https://mermaid.js.org/) 格式，可在 GitHub、VS Code (Mermaid 插件)、或 [mermaid.live](https://mermaid.live) 中直接渲染。

## 文件清单

| # | 文件 | 类型 | 说明 | 对应文档 |
|---|------|------|------|----------|
| 1 | `01_as_is_flow.mermaid` | Flowchart | 现状：居民如何找资源/互助 | [06_Blueprints §1.1](../docs/06_Blueprints.md) |
| 2 | `02_to_be_conceptual.mermaid` | Flowchart | To-Be 概念层：参与者与交互 | [06_Blueprints §2.1](../docs/06_Blueprints.md) |
| 3 | `03_to_be_logical.mermaid` | Flowchart | To-Be 逻辑层：服务与数据流 | [06_Blueprints §2.2](../docs/06_Blueprints.md) |
| 4 | `04_physical_deployment.mermaid` | Flowchart | 多云部署拓扑（AWS/GCP/Azure/Cloudflare Pages） | [06_Blueprints §2.3](../docs/06_Blueprints.md) + [19_Deployment_Guide §2](../docs/19_Deployment_Guide.md) |
| 5 | `05_p2p_event_flow.mermaid` | Sequence | P2P 事件流：发帖到匹配 | [07_P2P_Node_Design §4](../docs/07_P2P_Node_Design.md) |
| 6 | `06_report_flow.mermaid` | Sequence | 举报与处置流程 | [10_Security §4](../docs/10_Security_Privacy_Threat_Model.md) |
| 7 | `07_user_journey_first_open.mermaid` | Flowchart | 用户旅程：首次打开到获取价值 | [02_PRD §4](../docs/02_PRD.md) + [03_User_Flows](../docs/03_User_Flows_And_Screens.md) |
| 8 | `08_data_model_er.mermaid` | ER Diagram | 领域实体关系图（14 实体，含 `community_members` 与 `contact_requests`） | [08_Data_Model](../docs/08_Data_Model.md) |
| 9 | `09_post_lifecycle_state.mermaid` | **State Machine** | Post 生命周期状态流转 | [08_Data_Model §2.5](../docs/08_Data_Model.md) |
| 10 | `10_user_identity_state.mermaid` | **State Machine** | 用户身份升级（L0→L3） | [18_Auth_Design §2](../docs/18_Auth_Design.md) |
| 11 | `11_auth_flow_sequence.mermaid` | **Sequence** | 认证流程（匿名→OTP→JWT） | [18_Auth_Design §3](../docs/18_Auth_Design.md) |
| 12 | `12_chat_message_sequence.mermaid` | **Sequence** | 聊天消息全流程 | [09_API_Spec §5](../docs/09_API_Spec.md) |
| 13 | `13_p2p_sync_sequence.mermaid` | **Sequence** | P2P 同步（GossipSub + IPFS） | [07_P2P_Node_Design §5-6](../docs/07_P2P_Node_Design.md) |
| 14 | `14_use_case.mermaid` | **Use Case** | 全系统用例图（4 Actor × 23 UC） | [02_PRD §5](../docs/02_PRD.md) |

## 如何查看

1. **GitHub**：直接在仓库中点击 `.mermaid` 文件即可渲染
2. **VS Code**：安装 [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) 插件
3. **在线**：复制内容到 [mermaid.live](https://mermaid.live) 查看和编辑
4. **导出 PNG/SVG**：使用 `mmdc` CLI 工具（`npm install -g @mermaid-js/mermaid-cli`）

```bash
# 批量导出为 SVG
for f in diagrams/*.mermaid; do mmdc -i "$f" -o "${f%.mermaid}.svg"; done
```
