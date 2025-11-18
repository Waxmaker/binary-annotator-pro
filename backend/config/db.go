package config

import (
	"binary-annotator-pro/models"
	"database/sql"
	"fmt"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB wraps gorm.DB and raw sql.DB for graceful close
type DB struct {
	GormDB *gorm.DB
	SQLDB  *sql.DB
}

func InitDB(path string) (*DB, error) {
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	}
	gdb, err := gorm.Open(sqlite.Open(path), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	sqldb, err := gdb.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql db: %w", err)
	}

	// Set some reasonable defaults
	sqldb.SetMaxOpenConns(1)
	sqldb.SetMaxIdleConns(1)
	sqldb.SetConnMaxLifetime(time.Minute * 5)

	// Auto migrate
	if err := gdb.AutoMigrate(
		&models.File{},
		&models.YamlConfig{},
		&models.Tag{},
		&models.SearchResult{},
		&models.Note{},
		&models.ExtractedBlock{},
		&models.AISettings{},
		&models.ChatSession{},
		&models.ChatMessage{},
	); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	return &DB{GormDB: gdb, SQLDB: sqldb}, nil
}

// ReadBinaryFile reads a binary file from the database
func (db *DB) ReadBinaryFile(fileName string) ([]byte, error) {
	var file models.File
	if err := db.GormDB.Where("name = ?", fileName).First(&file).Error; err != nil {
		return nil, fmt.Errorf("file not found: %w", err)
	}
	return file.Data, nil
}
