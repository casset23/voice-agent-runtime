# 构建脚本参考：
# https://pnpm.io/docker

FROM node:24-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

# 先复制和下载依赖相关的文件，先行安装依赖
# 此处不需要换成 NPM，否则会带来不稳定依赖变化，且对构建性能并没有太多提升
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 再复制完整的源代码到此处并执行构建
COPY . ./
RUN pnpm build

FROM nginx:stable-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/deploy/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 
