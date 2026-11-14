---
title: "容器与镜像安全"
description: "容器不是安全边界——非 root 运行、只读根文件系统、能力裁剪、镜像瘦身与扫描，以及那些会让容器逃逸变得轻而易举的配置（挂 docker.sock、privileged）。"
source: "https://daiw.org/manual/web-security/container-security"
---

# 容器与镜像安全

容器不是安全边界——非 root 运行、只读根文件系统、能力裁剪、镜像瘦身与扫描，以及那些会让容器逃逸变得轻而易举的配置（挂 docker.sock、privileged）。

先破除一个常见误解：

> **容器不是安全边界。** 它是**资源与命名空间的隔离**，不是虚拟机级别的安全隔离。共享同一个内核意味着：一个内核漏洞就可能让攻击者从容器逃到宿主机。

所以容器安全的目标不是「让容器牢不可破」，而是**「即使应用被攻破，攻击者在容器里也做不了什么，更逃不出去」**。

## 一、镜像：从小做起

**基础镜像越小，攻击面越小。**

| 基础镜像 | 大致体量 | 说明 |
| --- | --- | --- |
| `ubuntu` / `debian` | 数百 MB | 包含完整发行版，几百个包，几百个潜在 CVE |
| `node:22-slim` | 中等 | 精简了一部分 |
| **`node:22-alpine`** | 小 | musl libc，包极少。**多数场景的好选择** |
| `gcr.io/distroless/nodejs22` | 更小 | **连 shell 都没有** |
| `scratch` | 0 | 只适合静态编译的二进制（Go、Rust） |

::: info
**distroless 的关键价值是「没有 shell」。** 大量攻击链的第一步是「拿到一个 shell」——反弹 shell、`sh -c` 执行命令。镜像里连 `/bin/sh` 都不存在，很多现成的利用脚本直接失效。

代价是**调试困难**（不能 `docker exec -it ... sh`）。折中方案：生产用 distroless，需要排查时用 `kubectl debug` 之类的临时调试容器附加上去。
:::

### 多阶段构建

构建工具、源码、开发依赖**都不该进最终镜像**：

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── 最终镜像只拿产物 ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
```

**注意 `--ignore-scripts`**：它阻止依赖包的 `postinstall` 脚本在构建时执行——这是 npm 供应链投毒最常用的执行点。

### 绝不把密钥 COPY 进镜像

[密钥那一章](/manual/computer-programming/web-security/secrets)讲过：`COPY .env` 之后 `RUN rm .env` **删不掉前一层里的文件**。

```dockerfile
# ✅ BuildKit secret mount：文件只在这一条 RUN 期间存在，不进任何层
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc pnpm install
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

## 二、运行时：把权限剥光

### 非 root 运行

```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

::: warning
**容器里的 root 就是宿主机的 root**（除非启用了 user namespace remapping，而默认没有）。

这意味着：容器内的 root + 一个内核漏洞 + 一个错误挂载 = 宿主机沦陷。**加 `USER` 这一行是成本最低、收益最大的容器加固措施。**

验证：

  ```bash
  docker run --rm myimage:latest id
  # 应该看到 uid=101(app)，而不是 uid=0(root)
  ```
:::

### 只读根文件系统

```yaml
services:
  app:
    image: myapp:latest
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777      # 确实需要写的地方单独给 tmpfs
    volumes:
      - app-cache:/app/.cache
```

**为什么有效**：攻击者拿到 RCE 后的第一件事通常是**落地一个文件**——下载工具、写 webshell、放持久化脚本。根文件系统只读，这一步直接失败，攻击链断在这里。

### 裁剪 Linux 能力

Docker 默认给容器一组 capabilities，绝大多数应用一个都不需要：

```yaml
services:
  app:
    cap_drop:
      - ALL                    # 先全部丢弃
    cap_add:
      - NET_BIND_SERVICE       # 只有需要绑定 1024 以下端口时才加
    security_opt:
      - no-new-privileges:true # 禁止通过 setuid 提权
```

`no-new-privileges` 值得单说：它让进程**永远无法通过 `setuid` 二进制获得更高权限**。很多提权链依赖找一个 setuid 程序，这一行把它们全部掐断。

### 资源限制

```yaml
services:
  app:
    mem_limit: 512m
    cpus: 1.0
    pids_limit: 200          # 防 fork 炸弹
```

**没有资源限制时，一个容器能拖垮整台宿主机**——这既是可用性问题，也是安全问题（[DoS 那一章](/manual/computer-programming/web-security/ddos-and-ratelimit)讲的应用层耗尽，在容器环境下会波及邻居）。

## 三、绝对不要做的几件事

::: warning
**这几个配置等于直接把宿主机交出去：**

| 配置 | 后果 |
| --- | --- |
| `--privileged` | **几乎等同于宿主机 root**。容器可以访问所有设备、加载内核模块 |
| 挂载 `/var/run/docker.sock` | 容器内可以创建新容器——**包括一个挂载了宿主机根目录的特权容器**。这是最经典的逃逸路径 |
| `--net=host` | 容器直接用宿主机网络栈，绕过所有网络隔离 |
| `--pid=host` | 能看到并操作宿主机上的所有进程 |
| 挂载宿主机敏感目录 | `-v /:/host`、`-v /etc:/etc` |

**`docker.sock` 那条最需要警惕**，因为它经常出现在「CI runner」「监控工具」「容器管理面板」的部署文档里，看起来很正常。一旦那个容器里的应用有 RCE，攻击者就能：

  ```bash
  # 在容器里，通过 docker.sock 启动一个挂载宿主机根目录的特权容器
  docker run -v /:/host --privileged -it alpine chroot /host sh
  ```

需要容器管理能力时，用**受限的 API 代理**（只暴露必要的操作），而不是直接挂 socket。
:::

## 四、扫描镜像

```bash
# Trivy：扫系统包 + 应用依赖 + 配置错误
trivy image --severity HIGH,CRITICAL myapp:latest

# 只看有修复版本的（没有补丁的先不用焦虑）
trivy image --severity HIGH,CRITICAL --ignore-unfixed myapp:latest

# 扫 Dockerfile 的配置问题
trivy config ./deploy/

# 扫镜像里是否夹带了密钥
trivy image --scanners secret myapp:latest
```

**`--ignore-unfixed` 很实用**：基础镜像里总有一批「已知但上游还没修」的 CVE，它们不可行动，只会淹没真正需要处理的条目。

接进 CI：

```yaml
- name: Scan image
  run: |
    trivy image --exit-code 1 --severity CRITICAL --ignore-unfixed myapp:${{ github.sha }}
```

**先只卡 CRITICAL**，等基线干净了再收紧到 HIGH。一上来就卡 HIGH，大概率第一天就被绕过。

### 定期重建，而不只是重扫

::: info
**一个容易忽略的点：镜像不会自己变安全。**

你三个月前构建的镜像，基础镜像里的 `openssl` 还是三个月前那个版本——即使上游早就发了补丁。**扫描能发现它，但只有重新构建才能修复它。**

所以要有一个**定期重建**的机制（比如每周自动重建并部署），而不是「代码没改就一直用老镜像」。这也是为什么镜像 tag 要用 commit SHA 而不是只有 `latest`——你需要知道现在跑的到底是哪一次构建。
:::

## 五、镜像来源与完整性

- **锁定基础镜像的 digest**，不只是 tag：

  ```dockerfile
  # tag 可以被重新指向，digest 不可变
  FROM node:22-alpine@sha256:abc123...
  ```

- **私有镜像仓库要有访问控制**，别让镜像可以被匿名 pull（里面可能有内部信息）。
- **镜像签名**（cosign / Notary）：确保部署的镜像确实是你构建的那个。对多人协作或有合规要求的场景值得上。

## 检查清单

- [ ] 多阶段构建，最终镜像不含源码与构建工具
- [ ] 基础镜像用 alpine / slim / distroless，并锁 digest
- [ ] `USER` 非 root（`docker run --rm image id` 验证过）
- [ ] `--ignore-scripts` 安装依赖
- [ ] 密钥用 BuildKit secret mount，翻层确认过没夹带
- [ ] `read_only: true` + 必要的 tmpfs
- [ ] `cap_drop: ALL` + `no-new-privileges`
- [ ] 设了内存/CPU/pids 限制
- [ ] **没有** `privileged`、`docker.sock`、`net=host`、`pid=host`
- [ ] Trivy 接进 CI，且有定期重建机制
- [ ] 端口只绑回环（由本机反代访问），不直接暴露公网

## 小结

- **容器不是安全边界**，目标是「被攻破后做不了什么，也逃不出去」。
- 镜像越小攻击面越小；**distroless 的核心价值是没有 shell**。
- **`USER` 非 root 是性价比最高的一行**——容器内 root 就是宿主机 root。
- **只读根文件系统**能直接掐断「落地文件」这一步，攻击链断在那里。
- `cap_drop: ALL` + `no-new-privileges` 掐掉大部分提权链。
- **`docker.sock`、`privileged`、`net=host` 是三条红线**，挂了就等于交出宿主机。
- **镜像不会自己变安全，要定期重建**，光扫描不重建等于知道了但没修。

第六部分结束。下一部分谈架构层面。👉 [纵深防御与最小权限](/manual/computer-programming/web-security/defense-in-depth)
