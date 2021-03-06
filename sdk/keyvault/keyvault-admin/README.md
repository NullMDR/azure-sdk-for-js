# Azure Key Vault Administration client library for JavaScript

Azure Key Vault is a service that allows you to encrypt authentication keys, storage account keys, data encryption keys, .pfx files, and passwords by using secured keys.
If you would like to know more about Azure Key Vault, you may want to review: [What is Azure Key Vault?][docs-overview]

The package `@azure/keyvault-admin` provides support for the administrative Key Vault tasks. It includes the backup and restore operations for whole Key Vault instances, and the role-based access control (RBAC) operations.

[Source code][package-gh] | [Package (npm)][package-npm] | [API Reference Documentation][docs] | [Product documentation][docs-service] | [Samples][samples]

## Getting started

### Install the package

Install the Azure Key Vault administration client library for JavaScript and TypeScript with [NPM][NPM]:

```PowerShell
npm install @azure/keyvault-admin
```

### Prerequisites

To work with the Azure Key Vault Administration client, the following is necessary:

* An [Azure subscription][azure-sub].
* An existing Azure Key Vault. If you need to create an Azure Key Vault, you can use the [Azure CLI][azure-cli].
* Use [Node.js](https://nodejs.org/) 8.x or higher.

#### Getting Azure credentials

Use the [Azure CLI][azure-cli] snippet below to create/get client secret credentials.

 * Create a service principal and configure its access to Azure resources:
    ```PowerShell
    az ad sp create-for-rbac -n <your-application-name> --skip-assignment
    ```
    Output:
    ```json
    {
        "appId": "generated-app-ID",
        "displayName": "some-app-name",
        "name": "http://some-app-name",
        "password": "random-password",
        "tenant": "tenant-ID"
    }
    ```
* Take note of the service principal objectId
    ```PowerShell
    az ad sp show --id <appId> --query objectId
    ```
    Output:
    ```
    "<your-service-principal-object-id>"
    ```
* Use the returned credentials above to set  **AZURE_CLIENT_ID** (appId), **AZURE_CLIENT_SECRET** (password), and **AZURE_TENANT_ID** (tenant) environment variables.

#### Get or create an Azure Key Vault with the Azure CLI

* Create the Key Vault and grant the above mentioned application authorization to perform administrative operations on the Azure Key Vault (replace `<your-resource-group-name>` and `<your-key-vault-name>` with your own, unique names and `<your-service-principal-object-id>` with the value from above):
    ```
    az keyvault create --hsm-name <your-key-vault-name> --resource-group <your-resource-group-name> --administrators <your-service-principal-object-id> --location <your-azure-location>
    ```

* Use the above mentioned Azure Key Vault name to retrieve details of your Vault which also contains your Azure Key Vault URL:
    ```PowerShell
    az keyvault show --hsm-name <your-key-vault-name>
    ```

#### Get or create an Azure Storage Account with the Azure CLI

A storage account is necessary to generate the backup of a Key Vault.

To generate Key Vault backups, you will need to point the `KeyVaultBackupClient` to an existing Storage account.

To create a new Storage Account, you can use the [Azure Portal][storage-account-create-portal],
[Azure PowerShell][storage-account-create-ps], or the [Azure CLI][storage-account-create-cli].
Here's an example using the Azure CLI:

```Powershell
az storage account create --name MyStorageAccount --resource-group MyResourceGroup --location westus --sku Standard_LRS
```

### Configure TypeScript

TypeScript users need to have Node type definitions installed:

```bash
npm install @types/node
```

You also need to enable `compilerOptions.allowSyntheticDefaultImports` in your tsconfig.json. Note that if you have enabled `compilerOptions.esModuleInterop`, `allowSyntheticDefaultImports` is enabled by default. See [TypeScript's compiler options handbook][compiler-options] for more information.

### Authenticate the client

In order to control permissions to the Key Vault service, or to generate and restore backups of a specific Key Vault, you'll need to create either an instance of the `KeyVaultAccessControlClient` class, or an instance of the `KeyVaultBackupClient` class, respectively.

In both cases, you'll need a **vault URL**, which you may see as "DNS Name" in the portal, and a credential object from the [@azure/identity][identity-npm] package which is used to authenticate with Azure Active Directory.

In the below example, we are using a **client secret credentials (client id, client secret, tenant id)**,  but you can find more ways to authenticate with [Azure Identity][azure-identity]. To use the [DefaultAzureCredential][DAC] provider shown below, or other credential providers provided with the Azure SDK, you should install the [@azure/identity][identity-npm] package:

```PowerShell
npm install @azure/identity
```

#### Create KeyVaultAccessControlClient

Once you've populated the **AZURE_CLIENT_ID**, **AZURE_CLIENT_SECRET** and **AZURE_TENANT_ID** environment variables and replaced **your-vault-url** with the above returned URI, you can create the `KeyVaultAccessControlClient`:

```ts
import { DefaultAzureCredential } from "@azure/identity";
import { KeyVaultBackupClient } from "@azure/keyvault-admin";

const credentials = new DefaultAzureCredential();

const vaultUrl = `https://<MY KEY VAULT HERE>.vault.azure.net`;
const client = new KeyVaultAccessControlClient(vaultUrl, credentials);
```

#### Create KeyVaultBackupClient

Once you've populated the **AZURE_CLIENT_ID**, **AZURE_CLIENT_SECRET** and **AZURE_TENANT_ID** environment variables and replaced **your-vault-url** with the above returned URI, you can create the `KeyVaultBackupClient`:

```ts
import { DefaultAzureCredential } from "@azure/identity";
import { KeyVaultBackupClient } from "@azure/keyvault-admin";

const credentials = new DefaultAzureCredential();

const vaultUrl = `https://<MY KEY VAULT HERE>.vault.azure.net`;
const client = new KeyVaultBackupClient(vaultUrl, credentials);
```

## Key concepts

### KeyVaultRoleDefinition

A Role Definition is a collection of permissions. A role definition defines the operations that can be performed, such as read, write, and delete. It can also define the operations that are excluded from allowed operations.

Role definitions can be listed and specified as part of a Role Assignment.

### KeyVaultRoleAssignment.

A Role Assignment is the association of a Role Definition to a service principal. They can be created, listed, fetched individually, and deleted.

### KeyVaultAccessControlClient

A `KeyVaultAccessControlClient` provides both synchronous and asynchronous operations allowing for management of Role Definitions (instances of `KeyVaultRoleDefinition`) and Role Assignments (instances of `KeyVaultRoleAssignment`).

### KeyVaultBackupClient

A `KeyVaultBackupClient` provides both synchronous and asynchronous operations for performing full key backups, full key restores, and selective key restores.

### Long running operations

The operations done by the `KeyVaultBackupClient` may take as much time as needed by the Azure resources, requiring a client layer to keep track, serialize and resume the operations through the lifecycle of the programs that wait for them to finish. This is done via a common abstraction through the package [@azure/core-lro][core-lro].

The `KeyVaultBackupClient` offers three methods that execute long running operations:

- `beginBackup`, starts generating a backup of an Azure Key Vault on the specified Storage Blob account.
- `beginRestore`, starts restoring all key materials using the SAS token pointing to a previously stored Azure Blob storage backup folder.
- `beginSelectiveRestore`, starts restoring all key versions of a given key using user supplied SAS token pointing to a previously stored Azure Blob storage backup folder.

The methods that begin long running operations return a poller that allows you to wait indefinitely until the operation is complete. More information is available on the examples below.

## Examples

We have samples both in JavaScript and TypeScript that show the access control and backup/restore features in this package. Please follow the corresponding readmes for detailed steps to run the samples.

- [Readme for JavaScript samples](./samples/javascript/README.md)
- [Readme for TypeScript samples](./samples/typescript/README.md)

Direct links to the specific JavaScript samples follow:

- Access control (RBAC):
    - [Listing All Role Definitions](./samples/javascript/accessControlHelloWorld.js)
    - [Listing All Role Assignments](./samples/javascript/accessControlHelloWorld.js)
    - [Creating a Role Assignment](./samples/javascript/accessControlHelloWorld.js)
    - [Getting a Role Assignment](./samples/javascript/accessControlHelloWorld.js)
    - [Deleting a Role Assignment](./samples/javascript/accessControlHelloWorld.js)
- Backup and restore:
    - [Performing a full key backup](./samples/javascript/backupRestoreHelloWorld.js)
    - [Performing a full key restore](./samples/javascript/backupRestoreHelloWorld.js)
    - [Performing a selective key backup](./samples/javascript/backupSelectiveRestore.js)
    - [Performing a selective key restore](./samples/javascript/backupSelectiveRestore.js)

## Troubleshooting

Enabling logging may help uncover useful information about failures. In order to see a log of HTTP requests and responses, set the `AZURE_LOG_LEVEL` environment variable to `info`. Alternatively, logging can be enabled at runtime by calling `setLogLevel` in the `@azure/logger`:

```javascript
import { setLogLevel } from "@azure/logger";

setLogLevel("info");
```

## Next steps

You can find more code samples through the following links:

- [KeyVault Administration Samples (JavaScript)](https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/keyvault/keyvault-admin/samples/javascript)
- [KeyVault Administration Samples (TypeScript)](https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/keyvault/keyvault-admin/samples/typescript)
- [KeyVault Administration Test Cases](https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/keyvault/keyvault-admin/test/)

## Contributing

If you'd like to contribute to this library, please read the [contributing guide](https://github.com/Azure/azure-sdk-for-js/blob/master/CONTRIBUTING.md) to learn more about how to build and test the code.

![Impressions](https://azure-sdk-impressions.azurewebsites.net/api/impressions/azure-sdk-for-js%2Fsdk%2Fkeyvault%2Fkeyvault-admin%2FREADME.png)

<!-- LINKS -->
[NPM]: https://www.npmjs.com/
[package-gh]: https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/keyvault/keyvault-admin
[package-npm]: https://www.npmjs.com/package/@azure/keyvault-admin
[identity-npm]: https://www.npmjs.com/package/@azure/identity
[docs]: https://docs.microsoft.com/javascript/api/@azure/keyvault-admin
[docs-service]: https://azure.microsoft.com/services/key-vault/
[docs-overview]: https://docs.microsoft.com/azure/key-vault/key-vault-overview
[samples]: https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/keyvault/keyvault-admin/samples
[azure-sub]: https://azure.microsoft.com/free/
[azure-cli]: https://docs.microsoft.com/cli/azure
[azure-identity]: https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/identity/identity
[api-rest]: https://docs.microsoft.com/rest/api/keyvault/
[compiler-options]: https://www.typescriptlang.org/docs/handbook/compiler-options.html
[dotenv]: https://www.npmjs.com/package/dotenv]
[DAC]: https://github.com/Azure/azure-sdk-for-net/blob/master/sdk/identity/Azure.Identity/README.md
[storage-account-create-ps]: https://docs.microsoft.com/azure/storage/common/storage-quickstart-create-account?tabs=azure-powershell
[storage-account-create-cli]: https://docs.microsoft.com/azure/storage/common/storage-quickstart-create-account?tabs=azure-cli
[storage-account-create-portal]: https://docs.microsoft.com/azure/storage/common/storage-quickstart-create-account?tabs=azure-portal
[core-lro]: https://github.com/Azure/azure-sdk-for-js/tree/master/sdk/core/core-lro
[code_of_conduct]: https://opensource.microsoft.com/codeofconduct/
[backup_client]: ./src/KeyVaultBackupClient.cs
[keyvault_docs]: https://docs.microsoft.com/azure/key-vault/
[JWK]: https://tools.ietf.org/html/rfc7517
[logging]: https://github.com/Azure/azure-sdk-for-net/blob/master/sdk/core/Azure.Core/samples/Diagnostics.ts.com/Azure/azure-sdk-for-net/blob/master/sdk/keyvault/Microsoft.Azure.KeyVault/CONTRIBUTING.md


![Impressions](https://azure-sdk-impressions.azurewebsites.net/api/impressions/azure-sdk-for-net%2Fsdk%2Ftables%2FAzure.Data.Tables%2FREADME.png)
