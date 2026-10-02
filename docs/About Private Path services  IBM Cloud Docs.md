Private Path services provide private connectivity for IBM Cloud and third-party services. A Private Path service requires a Private Path network load balancer (NLB) to deploy a service on IBM Cloud and a Virtual Private Endpoint (VPE) gateway for consumers to connect to the service. Traffic stays on the IBM backbone without traversing the internet.

The typical process for creating private connectivity between providers and consumers is as follows:

Your ability to complete the following actions depends on the level of IAM permissions that are associated with your IBM Cloud account. For more information, see [Required permissions](https://cloud.ibm.com/docs/iam?topic=iam-iam-service-roles-actions#is.private-path-service-gateway-roles).

## Private Path service use cases

The following use cases show you the various ways that you can use Private Path services.

Note: In all Private Path use cases, you can use ALB policy capabilities to direct Private Path service traffic.

### Use case 1: Connecting a service to a single consumer

As a provider, you want to connect your service to a consumer without traffic traversing the internet and without giving access to your entire VPC. Your consumer can be a customer, other division in your company, or something else.

This figure illustrates how to establish a Private Path service. Establishing a Private Path service enables you to expose a service to a customer privately.

First, a consumer's application connects to a VPE gateway in the consumer's VPC. Then, the VPE gateway connects to the Private Path NLB in the provider's VPC. In turn, the Private Path NLB connects to the provider's service. The provider's service then responds to the consumer's request through Direct Server Return (DSR). This Private Path service activity is completely contained in a single region (US South) in an IBM Cloud private network.

### Use case 2: Connecting a service to multiple consumers

This figure illustrates how to establish a Private Path service with connections to multiple consumer' VPE gateways.

First, a consumer's application connects to a VPE gateway in the consumer's VPCs. Then, the VPE gateway connects to the Private Path NLB in the provider's VPC. In turn, the Private Path NLB connects to the provider's service. The provider's service then responds to the consumer's request through DSR. This Private Path service activity is completely contained in a single region (US South) in an IBM Cloud private network.

### Use case 3: Connecting a service to a customer within your VPC

This diagram illustrates how to establish a Private Path service with connections to the VPE gateway of a consumer within your VPC.

Tip: Use a Private Path service within a single VPC if you need to enhance the performance and scalability of a Private Path network load balancer.

First, a consumer's application connects to the consumer's VPE gateway within the provider's VPC. Then, the VPE gateway connects to the Private Path NLB in the provider's VPC. In turn, the Private Path NLB connects to the provider's service. The provider's service then responds to the consumer's request through DSR. This Private Path service activity is completely contained in a single region (US South) in an IBM Cloud private network.

### Use case 4: Enabling an IBM Cloud service to connect to a provider's VPC

Private Path allows connection between an IBM Cloud service like IBM Cloud Code Engine and your VPC without compromising security or putting your VPC at risk. Code Engine is a multi-tenant compute service that runs source-code or containerized workloads. Its dynamic scaling capabilities allow your apps to automatically scale up and down, even to zero, based on incoming requests. With its pay-per-use model, Code Engine only charges for the compute capacity you actually use. For more information, see [IBM Cloud Code Engine (opens in a new tab)](https://www.ibm.com/products/code-engine).

This diagram illustrates how to establish a Private Path service with connections to the VPE gateway of a Code Engine application and your VPC. First, the Code Engine application connects to the VPE gateway within the Code Engine's VPC. Then, the VPE gateway connects to the Private Path NLB in the provider's VPC. In turn, the Private Path NLB connects to the provider's application. The provider's application then responds to the request. This Private Path service activity is completely contained in a single region (`us-south`) in an IBM Cloud private network.

### Use case 5: Using an ALB with a Private Path NLB to host services outside a VPC

The following diagram illustrates the process of setting up a Private Path service to connect a consumer's service to a provider's endpoint, which can be hosted on-premises or in other private locations that are accessible from the provider's VPC:

1.  The consumer's application or service connects to a virtual private endpoint (VPE) gateway within the consumer’s VPC.
    
    The consumer's VPC can be an IBM service with Private Path support, such as MQ as a Service or Code Engine. This enables connections like linking an on-cloud MQ Queue Manager with an on-premises Queue Manager, or connecting a Code Engine project to on-premises resources.
    
2.  The VPE gateway then links to the Private Path network load balancer (NLB) located in the provider's VPC.
    
3.  To enable the Private Path NLB to reach its on-premises endpoint, the provider adds their application load balancer (ALB) as a member of the Private Path NLB.
    
4.  The provider configures the on-premises endpoint as an ALB pool member.
    
5.  Finally, the provider connects the on-premises endpoint to their ALB using IBM Cloud Direct Link.
    

The provider can further harness ALB policy capabilities to direct traffic to the relevant ALB pool and member. For more information, see [Policy-based load balancing](https://cloud.ibm.com/docs/vpc?topic=vpc-layer-7-load-balancing).

Important: It is recommended to enable zonal affinity in the Private Path service to ensure that traffic from the client to the VPE gateway is directed to a Private Path NLB and ALB within the same zone (if available), thereby avoiding cross-zone traffic.

### Use case 6: Connecting a service to a consumer using Direct Link or Transit Gateway

The following diagram illustrates how a consumer can access a Private Path service from multiple environments using Direct Link or Transit Gateway.

A consumer can host their application in one VPC and connect to an endpoint gateway in another VPC. For example, an application in **Consumer VPC 1** can reach an endpoint gateway in **Consumer VPC 2** through a transit gateway. Similarly, an on-premises application can connect to the endpoint gateway in **Consumer VPC 2** through Direct Link.

The endpoint gateway provides access to the Private Path service by connecting to a Private Path Network Load Balancer (NLB) in the **Provider VPC**. The Private Path NLB then routes traffic to the provider’s service. For more information, see [High Availability access to VPE from Transit Gateway or Direct Link](https://cloud.ibm.com/docs/vpc?topic=vpc-about-vpe#ha-access-to-vpe-using-custom-dns-resolvers).