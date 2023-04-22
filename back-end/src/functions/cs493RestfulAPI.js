import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand, 
  UpdateCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({region: 'us-west-2'});

const dynamoDb = DynamoDBDocumentClient.from(client);

const TABLE = 'api-gateway-test';

function onlyContainsChar(str, char) {
    for (let i = 0; i < str.length; i++) {
        if (str[i] !== char) {
            return false;
        }
    }
    return true;
}

async function deleteNestedObject(tableName, primaryKey, primaryValue, nestedObjectKeys) {
 const updateExpression = `REMOVE ${nestedObjectKeys.join('.')}`;
 const params = {
  TableName: tableName,
  Key: {
   [primaryKey]: primaryValue
  },
  UpdateExpression: updateExpression,
  ReturnValues: 'ALL_NEW'
 };
 try {
    await dynamoDb.send(new UpdateCommand(params));
    console.log("Delete succeeded");
  } catch (err) {
    console.error("Delete failed", err);
  }
}

async function updateNestedObject(tableName, primaryKey, primaryValue, nestedObjectKeys, newDatas) {
  const newData = JSON.parse(newDatas);
  const updateExpression = Object.keys(newData).map((key) => `${nestedObjectKeys.join('.')}.${key} = :${key}`).join(", ");
  const expressionAttributeValues = Object.entries(newData).reduce((acc, [key, value]) => {
    acc[`:${key}`] = value;
    return acc;
  }, {});
  const params = {
    TableName: tableName,
    Key: {
      [primaryKey]: primaryValue
    },
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeValues: expressionAttributeValues
  };
  try {
    await dynamoDb.send(new UpdateCommand(params));
    console.log("Update succeeded");
  } catch (err) {
    console.error("Update failed", err);
  }
}

export const handler = async (event) => {
 
 const request = event['httpMethod'];
 let data = await dynamoDb.send(
          new ScanCommand({ TableName: TABLE })
        );
        // data = data.Items;
 const response = {
   isBase64Encoded: false,
   headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
 };
 
 if ((typeof data) === 'object') {
   response.statusCode = 200;
   
   var path = JSON.stringify(event['path']);
   path.replace('"','');
   const pathArray = path.split("/");
   // pathArray.pop()
   pathArray.shift();
   pathArray[pathArray.length-1] = pathArray[pathArray.length-1].replace('\"','');
   const businessPath = data['Items'][0];
   const userPath = data['Items'][1];
   switch (request) {
    case 'GET':
     if (pathArray[0] == 'business') {
      let result = businessPath;
      if (pathArray.length >= 1) {
       result = result['entityName'];
       for (let i = 1; i < pathArray.length; i++) {
            result = result[pathArray[i]];
        }
      }
      response.body = JSON.stringify(result);
     }
     else if (pathArray[0] == 'user'){
      let result = userPath;
      if (pathArray.length >= 1) {
       result = result['entityName'];
       for (let i = 1; i < pathArray.length; i++) {
            result = result[pathArray[i]];
        }
      }
      response.body = JSON.stringify(result);
     }
     else {
      response.body = JSON.stringify(data['Items']);
     }
     break;
    case 'POST':
     const eventBody = event['body'];
     if (pathArray[0] == 'business') {
      let result = ["entityName"];
      for (let i = 1; i < pathArray.length; i++) {
            result.push(pathArray[i]);
        }
      console.log(typeof eventBody);
      let jsonEventBody = JSON.parse(eventBody);
      for (const business in jsonEventBody) {
        console.log(business);
        let reviews = jsonEventBody
        if (jsonEventBody[business].hasOwnProperty("reviews")) {
          reviews = reviews[business].reviews;
        }
        for (const review in reviews) {
          if (reviews[review].starRating > 5 || reviews[review].starRating < 0) {
            result.push("Your Rating was Invalid");
            break;
          }
          if (reviews[review].priceRating.length > 3 || reviews[review].priceRating.length < 1 || !onlyContainsChar(reviews[review].priceRating, "$")) {
            result.push("Your Rating was Invalid");
            break;
          }
        }
      }
      console.log(result);
      if (result.toString().includes("Your Rating was Invalid")) {
        result = "One of your ratings was invalid. For your star rating please make sure you are only inputting a number from 0-5 and that you are only inputting a $ between 1-3 times for your price rating.";
      } else {
        updateNestedObject("api-gateway-test", "id", "business", result, eventBody);
      }
    //   updateNestedObject("api-gateway-test", "id", "business", result, eventBody);
      response.body = JSON.stringify("Your POST request was successfully completed");
     }
     else if (pathArray[0] == 'user'){
      updateNestedObject("api-gateway-test", "id", "user", ["entityName"], eventBody);
      response.body = JSON.stringify(event);
     }
     else {
      response.body = JSON.stringify(data['Items']);
     }
     // response.body = request
     break;
    case 'DELETE':
     if (pathArray[0] == 'business') {
      let result = ["entityName"];
      for (let i = 1; i < pathArray.length; i++) {
            result.push(pathArray[i]);
        }
      deleteNestedObject("api-gateway-test", "id", "business", result);
      response.body = JSON.stringify(result);
     }
     else if (pathArray[0] == 'user'){
      let result = ["entityName"];
      for (let i = 1; i < pathArray.length; i++) {
            result.push(pathArray[i]);
        }
      deleteNestedObject("api-gateway-test", "id", "user", result);
      response.body = JSON.stringify(result);
     }
     else{
      response.body = JSON.stringify(data['Items']);
     }
     break;
    default: 
     response.body = (`Unknown request: ${request}`);
   }
 } else {
   response.statusCode = 500;
 }
 return response;
};