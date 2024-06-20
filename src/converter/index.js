import React from "react";
import { useState } from "react";
import { Button, Wrapper } from "./styles";
import Input from "../input";
import InputTextarea from "../textarea";
import {
  each,
  find,
  get,
  join,
  map,
  replace,
  set,
  size,
  toUpper,
  unset,
} from "lodash";

const ConverterComponent = (props) => {
  const [awsAccountId, setAwsAccountId] = useState("");
  const [awsInternalUrl, setAwsInternalUrl] = useState("");
  const [awsDefaultRegion, setAwsDefaultRegion] = useState("");
  const [awsVPCLinkId, setAwsVPCLinkId] = useState("");
  // const [awsHost, setAwsHost] = useState("");
  // const [awsBasePath, setAwsBasePath] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [jsonOutput, setJsonOutput] = useState("");

  const convertData = () => {
    const errors = [];
    if (size(awsAccountId) === 0) {
      errors.push("awsAccountId");
    }
    if (size(awsInternalUrl) === 0) {
      errors.push("awsInternalUrl");
    }
    if (size(awsDefaultRegion) === 0) {
      errors.push("awsDefaultRegion");
    }
    if (size(awsVPCLinkId) === 0) {
      errors.push("awsVPCLinkId");
    }
    if (size(jsonInput) === 0) {
      errors.push("jsonInput");
    }
    if (size(errors) > 0) {
      alert("Required: " + errors.join(", "));
      return;
    }

    const data = JSON.parse(jsonInput);

    // Adds host
    // if (size(awsHost) > 0) {
    //   set(data, "host", awsHost);
    // }

    // Adds basePath
    // if (size(awsBasePath) > 0) {
    //   set(data, "basePath", awsBasePath);
    // }

    // Adds schemes
    // set(data, "schemes", ["https"]);

    // Adds health check resource path
    set(data.paths, "/actuator/health", {
      get: {
        tags: ["actuator-health"],
        operationId: "actuatorHealth",
        responses: {
          500: {
            description: "Ocorreu algum erro interno",
            content: { "application/json": {} },
          },
          200: {
            description: "Tudo funcionou como esperado",
            content: { "application/json": {} },
          },
        },
      },
    });

    each(data.paths, (path, endpoint) => {
      let hasOptions = false;
      const pathParameters = [];
      const methods = ["OPTIONS"];

      // Adds API Gateway configuration
      each(path, (method, type) => {
        const requestParameters = {};

        if (toUpper(type) === "OPTIONS") {
          hasOptions = true;
        } else {
          methods.push(toUpper(type));
          // If secured endpoint, adds authorization header
          if (size(method.security) > 0) {
            if (!method.parameters) {
              set(method, "parameters", []);
            }
            method.parameters.push({
              name: "Authorization",
              in: "header",
              required: true,
              schema: {
                type: "string",
              },
            });
          }

          // If has parameters filter path and add requests parameters to be added in amazon-apigateway configuration
          if (method.parameters) {
            each(method.parameters, (param) => {
              if (
                param.in === "path" &&
                find(pathParameters, (it) => it.name === param.name) ===
                  undefined
              ) {
                pathParameters.push(param);
              }
              const paramType = param.in === "query" ? "querystring" : param.in;
              requestParameters[
                `integration.request.${paramType}.${param.name}`
              ] = `method.request.${paramType}.${param.name}`;
            });
          }

          unset(method, "tags");

          // Adds amazon-apigateway configuration
          set(method, "x-amazon-apigateway-integration", {
            connectionId: awsVPCLinkId,
            connectionType: "VPC_LINK",
            httpMethod: toUpper(type),
            type: "http_proxy",
            uri: `${awsInternalUrl}${endpoint}`,
            passthroughBehavior: "when_no_match",
            responses: { default: { statusCode: "200" } },
            requestParameters,
          });

          // Set content for each response
          if (method.responses) {
            each(method.responses, (response) => {
              set(response, "content", {});
            });
          }
        }
      });

      // Adds OPTIONS method
      if (!hasOptions) {
        set(path, "options", {
          // consumes: ["application/json"],
          parameters: size(pathParameters) > 0 ? pathParameters : undefined,
          responses: {
            200: {
              description: "200 response",
              headers: {
                "Access-Control-Allow-Origin": { schema: { type: "string" } },
                "Access-Control-Allow-Methods": { schema: { type: "string" } },
                "Access-Control-Allow-Headers": { schema: { type: "string" } },
              },
              content: {},
            },
          },
          "x-amazon-apigateway-integration": {
            responses: {
              default: {
                statusCode: "200",
                responseParameters: {
                  "method.response.header.Access-Control-Allow-Methods": `'${join(
                    methods,
                    ","
                  )}'`,
                  "method.response.header.Access-Control-Allow-Headers":
                    "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                  "method.response.header.Access-Control-Allow-Origin": "'*'",
                },
              },
            },
            requestTemplates: {
              "application/json": '{"statusCode": 200}',
            },
            passthroughBehavior: "when_no_match",
            type: "mock",
          },
        });
      }
    });

    // Replaces Account ID and AWS Timezone
    const authorizer = get(
      data,
      "components.securitySchemes.APICustomAuthorizationHeader.x-amazon-apigateway-authorizer"
    );

    let credentials = get(authorizer, "authorizerCredentials");
    credentials = replace(credentials, "aws-account-id", awsAccountId);
    set(authorizer, "authorizerCredentials", credentials);

    let uri = get(authorizer, "authorizerUri");
    uri = replace(uri, "aws-account-id", awsAccountId);
    uri = replace(uri, "aws-default-region", awsDefaultRegion);
    uri = replace(uri, "aws-default-region", awsDefaultRegion); // There's two occurences (function didn't work)
    set(authorizer, "authorizerUri", uri);

    // set gateway responses
    set(data, "x-amazon-apigateway-gateway-responses", {
      DEFAULT_4XX: {
        responseParameters: {
          "gatewayresponse.header.Access-Control-Allow-Methods": "'OPTIONS'",
          "gatewayresponse.header.Access-Control-Allow-Headers":
            // eslint-disable-next-line no-multi-str
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,\
             User-Agent, Accept'",
          "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
        },
      },
      DEFAULT_5XX: {
        responseParameters: {
          "gatewayresponse.header.Access-Control-Allow-Methods": "'OPTIONS'",
          "gatewayresponse.header.Access-Control-Allow-Headers":
            // eslint-disable-next-line no-multi-str
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,\
             User-Agent, Accept'",
          "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
        },
      },
    });

    setJsonOutput(JSON.stringify(data));
  };

  return (
    <Wrapper>
      <Input
        name="awsAccountId"
        label="AWS Account ID"
        type="text"
        value={awsAccountId}
        onChange={(e) => setAwsAccountId(e.target.value)}
      />
      <Input
        name="awsDefaultRegion"
        label="AWS Default Region"
        type="text"
        value={awsDefaultRegion}
        onChange={(e) => setAwsDefaultRegion(e.target.value)}
      />
      {/* <Input
        name="awsHost"
        label="AWS application Host/Address"
        type="text"
        value={awsHost}
        onChange={(e) => setAwsHost(e.target.value)}
      /> */}
      {/* <Input
        name="awsBasePath"
        label="AWS application basePath (with slash)"
        type="text"
        value={awsBasePath}
        onChange={(e) => setAwsBasePath(e.target.value)}
      /> */}
      <Input
        name="awsInternalUrl"
        label="AWS Internal APP URL"
        type="text"
        value={awsInternalUrl}
        onChange={(e) => setAwsInternalUrl(e.target.value)}
      />
      <Input
        name="awsVPCLinkId"
        label="AWS VPC Link ID"
        type="text"
        value={awsVPCLinkId}
        onChange={(e) => setAwsVPCLinkId(e.target.value)}
      />
      <InputTextarea
        name="jsonInput"
        label="Json Input"
        type="textarea"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
      />

      <Button onClick={convertData}>Convert</Button>

      <InputTextarea
        name="jsonOutput"
        label="Json Output"
        type="textarea"
        value={jsonOutput}
        onChange={(e) => setJsonOutput(e.target.value)}
      />
    </Wrapper>
  );
};

export default ConverterComponent;
