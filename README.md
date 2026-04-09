# ⚡ EV Charge Station Platform

A full-stack Electric Vehicle (EV) Charging Station application designed to help users locate nearby charging stations, interact with real-time maps, and manage their charging sessions efficiently. 

This project is divided into two main architectures:
* **Frontend**: Built with React.js, Leaflet Maps, and SignalR for real-time tracking.
* **Backend**: Built with .NET (C#) to serve secure RESTful APIs and manage database connections.

---

## 👥 Meet the Team

This comprehensive system was developed collaboratively as an academic project:

* **Rudra Thakker** - Frontend Developer (React, Mapping, UI/UX)
* **Devichara Dasari** - Backend Developer (.NET Core APIs, Database Architecture)
* **Professor Viraj Daxini** - Project Guide & Supervisor

---

## 🛠️ Technology Stack

**Frontend (`EV_Frontend_v2.5`)**
* React 18
* React-Leaflet (Interactive Maps)
* Microsoft SignalR (Real-time communications)
* Google OAuth (Secure Authentication)

**Backend (`EV_Backend_v2.3`)**
* .NET Core / C#
* ASP.NET Web API 
* Entity Framework Core & SQL Database Management

---

## 🚀 How to Run this Project Locally

### Prerequisites
* [Node.js](https://nodejs.org/en/) (v16+ recommended for Frontend)
* [.NET SDK](https://dotnet.microsoft.com/download) (For Backend)
* A SQL Database Server (e.g., SQL Server)

### 1. Backend Setup (.NET)
1. Navigate to the Backend directory:
   ```bash
   cd backend/EV_Charge_Station
   ```
2. **Database Configuration**: Create or modify the `appsettings.json` file inside the backend directory and update the `DefaultConnection` string with your local SQL Database credentials. *(Do not upload your real credentials to GitHub!)*
3. Restore dependencies and run the server:
   ```bash
   dotnet restore
   dotnet run
   ```
4. The API will start on a local port (e.g., `https://localhost:7001` or `http://localhost:5000`).

### 2. Frontend Setup (React)
1. Open a new terminal and navigate to the Frontend directory:
   ```bash
   cd frontend
   ```
2. Install the necessary Node packages (If you encounter a peer dependency issue, use `--legacy-peer-deps`):
   ```bash
   npm install --legacy-peer-deps
   ```
3. *(Optional)* If your frontend requires an environment file, create a `.env` in the root of the frontend folder with necessary variables like API URLs or OAuth keys.
4. Start the React development server:
   ```bash
   npm start
   ```
5. The application should automatically open in your default browser at `http://localhost:3000`.

---

## 🍴 How to Fork this Project

If you want to contribute or build upon our work, you can easily fork this repository!

1. In the top-right corner of this GitHub repository page, click the **Fork** button.
2. Select where you want to fork the repository (e.g., your personal GitHub account).
3. Once the repository is forked, clone it to your local machine:
   ```bash
   git clone https://github.com/Charan-Dasari/EV_Charge_Station.git
   ```
4. Navigate into the cloned directory:
   ```bash
   cd EV_Charge_Station
   ```
5. Follow the **How to Run** instructions above to set up your local development environment!

---

> **Note to Developers:** Please ensure you respect the `.gitignore` rules in this project and avoid committing secure environments files (`.env`) or database connections arrays (`appsettings.json`) directly to branches!
