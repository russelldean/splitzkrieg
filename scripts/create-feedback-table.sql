-- Create feedback table for site visitor messages
CREATE TABLE feedback (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(100)  NULL,
  email       NVARCHAR(255)  NULL,
  message     NVARCHAR(2000) NOT NULL,
  pageUrl     NVARCHAR(500)  NULL,
  createdAt   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
