import { BadRequestException, Body, Controller, Get, Logger, Post, Version } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from 'src/services/database.service';
import { SoftlandGatewayService } from 'src/services/softland-gateway.service';
import { TaskService } from 'src/services/task.service';



@Controller('/main')
export class MainController {
  private readonly logger = new Logger(MainController.name);

  constructor(
    private readonly service: DatabaseService,
    private readonly softlandGatewayService: SoftlandGatewayService,
    private readonly taskService: TaskService,
  ) {}

  @Get('/proforma-pendiente-de-envio')
  @Version('1')
  @ApiOperation({
    summary: 'Endpoint para levantar proforma pendiente de envío y procesarla',
  })
  @ApiResponse({
    status: 200,
    description: 'Se inicia el proceso de envío de proforma a Softland',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  public async getProformasPendientes(): Promise<any> {
    // return await this.service.getProformaPendienteDeEnvio();
    return await this.taskService.processOneRow();
  }

  @Post('/envio-proforma-softland')
  @Version('1')
  @ApiOperation({ summary: 'endpoint para enviar proforma a softland' })
  @ApiResponse({
    status: 200,
    description: 'Se inicia el proceso de envio de proforma',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  public async envioProforma(@Body() body: any): Promise<any> {
    this.logger.verbose(
      'Iniciando proceso de envio de proforma. -> ' + JSON.stringify(body),
    );

  try {
      // Enviar los datos al servicio y devolver la respuesta
      const result = await this.softlandGatewayService.envioProforma(body);
      return result;
    } catch (err) {
      // Manejo de errores
      if (err instanceof BadRequestException) {
        // Si es un BadRequestException (error específico), se lo reenviamos tal cual al cliente
        throw err;
      } else {
        // Si es otro tipo de error, podemos manejarlo como un InternalServerError
        throw new BadRequestException('Hubo un problema procesando la proforma. Detalles: ' + err.message);
      }
  }
}
}

