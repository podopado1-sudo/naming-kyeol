# =================================================================
# NameForm 백엔드 (ASP.NET Core .NET 10.0) — 멀티 스테이지 Docker 빌드
# =================================================================
#
# Stage 1 (build): SDK 이미지로 dotnet publish
# Stage 2 (runtime): 경량 aspnet 이미지에 실행 파일 + 데이터만 복사
#
# Render/Fly.io/Railway 등 컨테이너 PaaS에서 사용.
# 환경변수:
#   - DATABASE_URL   : postgresql://... (Supabase 등)
#   - ASPNETCORE_ENVIRONMENT=Production
#   - Cors__AllowedOrigins__0=https://namingkyeol.com
#   - Authentication__Enabled / Authentication__ApiKeys__0
#   - PORT (Render 자동 주입, 기본 10000)
# =================================================================

# ---------- Stage 1: Build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# 1) csproj 먼저 복사해 의존성 캐싱 (소스 변경 시 restore 재실행 회피)
COPY NameForm.csproj ./
RUN dotnet restore NameForm.csproj

# 2) 나머지 소스 복사 후 publish
COPY . .
RUN dotnet publish NameForm.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- Stage 2: Runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# 컨테이너 안에서 curl로 헬스체크 (Render의 health check에 사용 가능)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Publish 산출물 복사
COPY --from=build /app/publish ./

# Render는 PORT 환경변수를 컨테이너에 주입. 기본 10000.
ENV ASPNETCORE_URLS=http://+:${PORT:-10000}
EXPOSE 10000

# 비루트 사용자 — .NET 10 공식 이미지가 제공하는 기본 사용자 사용 ($APP_UID는 보통 1654)
# Microsoft 공식 권장 패턴: https://github.com/dotnet/dotnet-docker/blob/main/documentation/scenarios/nonroot.md
USER $APP_UID

ENTRYPOINT ["dotnet", "NameForm.dll"]
