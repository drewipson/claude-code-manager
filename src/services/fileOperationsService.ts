import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeFile, ClaudeFileType } from '../core/types';
import { FileDiscoveryService } from './fileDiscoveryService';
import {
  COMMANDS_DIR,
  SKILLS_DIR,
  AGENTS_DIR,
  MCP_DIR,
} from '../core/constants';

export class FileOperationsService {
  constructor(private fileDiscoveryService: FileDiscoveryService) {}

  async moveToGlobal(claudeFile: ClaudeFile): Promise<boolean> {
    if (claudeFile.scope === 'global') {
      vscode.window.showInformationMessage('File is already in global scope.');
      return false;
    }

    const globalPath = this.fileDiscoveryService.getGlobalClaudePath();
    const targetDir = this.getTargetDirectory(globalPath, claudeFile.type);
    const targetPath = path.join(targetDir, claudeFile.name);

    return this.moveFile(claudeFile.path, targetPath, 'global');
  }

  async moveToProject(claudeFile: ClaudeFile): Promise<boolean> {
    if (claudeFile.scope === 'project') {
      vscode.window.showInformationMessage('File is already in project scope.');
      return false;
    }

    const projectPath = this.fileDiscoveryService.getProjectClaudePath();
    if (!projectPath) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return false;
    }

    const targetDir = this.getTargetDirectory(projectPath, claudeFile.type);
    const targetPath = path.join(targetDir, claudeFile.name);

    return this.moveFile(claudeFile.path, targetPath, 'project');
  }

  private async moveFile(
    sourcePath: string,
    targetPath: string,
    targetScope: 'global' | 'project'
  ): Promise<boolean> {
    try {
      // Check if target already exists
      if (await this.fileExists(targetPath)) {
        const choice = await vscode.window.showWarningMessage(
          `File "${path.basename(targetPath)}" already exists in ${targetScope} scope.`,
          'Overwrite',
          'Rename',
          'Cancel'
        );

        if (choice === 'Cancel' || !choice) {
          return false;
        }

        if (choice === 'Rename') {
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new file name',
            value: path.basename(targetPath),
            validateInput: (value) => {
              if (!value || value.trim() === '') {
                return 'File name cannot be empty';
              }
              return null;
            },
          });

          if (!newName) {
            return false;
          }

          targetPath = path.join(path.dirname(targetPath), newName);
        }
      }

      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await fs.promises.mkdir(targetDir, { recursive: true });

      // Move the file
      await fs.promises.rename(sourcePath, targetPath);

      vscode.window.showInformationMessage(
        `Moved "${path.basename(sourcePath)}" to ${targetScope} scope.`
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to move file: ${message}`);
      return false;
    }
  }

  private getTargetDirectory(basePath: string, fileType: ClaudeFileType): string {
    const dirMap: Partial<Record<ClaudeFileType, string>> = {
      command: COMMANDS_DIR,
      skill: SKILLS_DIR,
      subAgent: AGENTS_DIR,
      mcp: MCP_DIR,
    };

    const subDir = dirMap[fileType];
    return subDir ? path.join(basePath, subDir) : basePath;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async createFile(
    type: ClaudeFileType,
    scope: 'global' | 'project',
    name: string,
    content: string,
    parentFolder?: string
  ): Promise<string | null> {
    const basePath =
      scope === 'global'
        ? this.fileDiscoveryService.getGlobalClaudePath()
        : this.fileDiscoveryService.getProjectClaudePath();

    if (!basePath) {
      vscode.window.showErrorMessage('Cannot determine target path.');
      return null;
    }

    const targetDir = this.getTargetDirectory(basePath, type);

    // If parentFolder is provided, use it as the subdirectory
    const finalDir = parentFolder ? path.join(targetDir, parentFolder) : targetDir;
    const targetPath = path.join(finalDir, name);

    try {
      // Ensure full directory path exists (including any subdirectories in the name)
      const fileDir = path.dirname(targetPath);
      await fs.promises.mkdir(fileDir, { recursive: true });

      // Check if file exists
      if (await this.fileExists(targetPath)) {
        const choice = await vscode.window.showWarningMessage(
          `File "${name}" already exists.`,
          'Overwrite',
          'Cancel'
        );

        if (choice !== 'Overwrite') {
          return null;
        }
      }

      // Write the file
      await fs.promises.writeFile(targetPath, content, 'utf-8');

      return targetPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to create file: ${message}`);
      return null;
    }
  }

  async revealInFinder(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand('revealFileInOS', uri);
  }

  async copyPath(filePath: string): Promise<void> {
    await vscode.env.clipboard.writeText(filePath);
    vscode.window.showInformationMessage('Path copied to clipboard.');
  }

  async deleteFile(claudeFile: ClaudeFile): Promise<boolean> {
    try {
      const fileName = path.basename(claudeFile.path);
      const choice = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${fileName}"?`,
        { modal: true },
        'Delete',
        'Cancel'
      );

      if (choice !== 'Delete') {
        return false;
      }

      // Check if it's a directory (for skills with folders)
      const stat = await fs.promises.stat(claudeFile.path);

      if (stat.isDirectory()) {
        // Delete directory and all contents
        await fs.promises.rm(claudeFile.path, { recursive: true, force: true });
      } else {
        // Delete single file
        await fs.promises.unlink(claudeFile.path);

        // If the parent directory is empty and it's in skills/agents/commands, delete it too
        const parentDir = path.dirname(claudeFile.path);
        const parentDirName = path.basename(path.dirname(parentDir));

        if (['skills', 'agents', 'commands'].includes(parentDirName)) {
          try {
            const filesInParent = await fs.promises.readdir(parentDir);
            if (filesInParent.length === 0) {
              await fs.promises.rmdir(parentDir);
            }
          } catch {
            // Ignore errors when trying to remove parent directory
          }
        }
      }

      vscode.window.showInformationMessage(`Deleted "${fileName}".`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to delete file: ${message}`);
      return false;
    }
  }

  async renameFile(claudeFile: ClaudeFile): Promise<boolean> {
    try {
      const currentName = path.basename(claudeFile.path);
      const isDirectory = claudeFile.isDirectory || false;

      let nameWithoutExt: string;
      let ext: string = '';

      if (isDirectory) {
        nameWithoutExt = currentName;
      } else {
        ext = path.extname(currentName);
        nameWithoutExt = path.basename(currentName, ext);
      }

      const newName = await vscode.window.showInputBox({
        prompt: isDirectory ? 'Enter new folder name' : 'Enter new name',
        value: nameWithoutExt,
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!newName || newName === nameWithoutExt) {
        return false;
      }

      const newFileName = isDirectory ? newName : newName + ext;
      const newPath = path.join(path.dirname(claudeFile.path), newFileName);

      // Check if target already exists
      if (await this.fileExists(newPath)) {
        vscode.window.showErrorMessage(`${isDirectory ? 'Folder' : 'File'} "${newFileName}" already exists.`);
        return false;
      }

      await fs.promises.rename(claudeFile.path, newPath);

      vscode.window.showInformationMessage(`Renamed to "${newFileName}".`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to rename: ${message}`);
      return false;
    }
  }

  async createFolder(
    type: ClaudeFileType,
    scope: 'global' | 'project'
  ): Promise<string | null> {
    const folderName = await vscode.window.showInputBox({
      prompt: 'Enter folder name',
      placeHolder: 'my-folder',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Folder name cannot be empty';
        }
        if (!/^[\w-]+$/.test(value)) {
          return 'Name can only contain letters, numbers, underscores, and hyphens';
        }
        return null;
      },
    });

    if (!folderName) {
      return null;
    }

    const basePath =
      scope === 'global'
        ? this.fileDiscoveryService.getGlobalClaudePath()
        : this.fileDiscoveryService.getProjectClaudePath();

    if (!basePath) {
      vscode.window.showErrorMessage('Cannot determine target path.');
      return null;
    }

    const targetDir = this.getTargetDirectory(basePath, type);
    const folderPath = path.join(targetDir, folderName);

    try {
      // Check if folder already exists
      if (await this.fileExists(folderPath)) {
        vscode.window.showErrorMessage(`Folder "${folderName}" already exists.`);
        return null;
      }

      // Create the folder
      await fs.promises.mkdir(folderPath, { recursive: true });

      vscode.window.showInformationMessage(`Created folder "${folderName}".`);
      return folderPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to create folder: ${message}`);
      return null;
    }
  }
}
