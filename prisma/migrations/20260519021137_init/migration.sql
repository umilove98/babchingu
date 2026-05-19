-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "canHost" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyDate" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "restaurantName" TEXT,
    "mapUrl" TEXT,
    "hostId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Party_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participation" (
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("partyId", "userId"),
    CONSTRAINT "Participation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RestaurantChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "newName" TEXT NOT NULL,
    "newMapUrl" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantChangeRequest_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RestaurantChangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "partyId" TEXT,
    "actorId" TEXT,
    "payload" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "Party_partyDate_idx" ON "Party"("partyDate");

-- CreateIndex
CREATE INDEX "Party_hostId_partyDate_idx" ON "Party"("hostId", "partyDate");

-- CreateIndex
CREATE INDEX "Participation_userId_idx" ON "Participation"("userId");

-- CreateIndex
CREATE INDEX "Comment_partyId_createdAt_idx" ON "Comment"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "RestaurantChangeRequest_partyId_status_idx" ON "RestaurantChangeRequest"("partyId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
