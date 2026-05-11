@echo off
cd /d c:\Users\ATG\Desktop\you\inspera
echo === Clearing Data ===
node scripts/clearInventoryData.js
echo.
echo === Importing Data ===
node scripts/importInventoryData.js
echo.
echo === Done ===
pause
