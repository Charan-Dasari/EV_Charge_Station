# Stage 1: Build & Publish with .NET 10 SDK
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY ["backend/EV_Charge_Station/EV_Charge_Station.csproj", "backend/EV_Charge_Station/"]
RUN dotnet restore "backend/EV_Charge_Station/EV_Charge_Station.csproj"

# Copy remaining source code and build
COPY backend/EV_Charge_Station/ backend/EV_Charge_Station/
WORKDIR "/src/backend/EV_Charge_Station"
RUN dotnet build "EV_Charge_Station.csproj" -c Release -o /app/build

# Publish release artifacts
RUN dotnet publish "EV_Charge_Station.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime image with ASP.NET Core .NET 10
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Expose Render default port and configure ASP.NET Core port binding
EXPOSE 10000
ENV ASPNETCORE_HTTP_PORTS=10000

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "EV_Charge_Station.dll"]
